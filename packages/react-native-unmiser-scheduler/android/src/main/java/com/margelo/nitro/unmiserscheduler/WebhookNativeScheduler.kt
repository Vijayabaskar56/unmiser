package com.margelo.nitro.unmiserscheduler

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

internal class WebhookNativeScheduler(private val context: Context) {
  private val appContext = context.applicationContext
  private val workManager = WorkManager.getInstance(appContext)
  private val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun apply(settings: WebhookScheduleSettings) {
    val previousIds = WebhookSchedulerStore.readArmedIds(appContext)
    val currentIds = settings.scheduledTimes.map { it.id }.toSet()
    val idsToCancel = previousIds + currentIds

    when (settings.syncMode) {
      "SCHEDULED" -> {
        cancelPeriodic()
        cancelScheduledAlarms(idsToCancel)
        val armed = settings.scheduledTimes.filter { it.enabled }
        armed.forEach(::scheduleSingleAlarm)
        WebhookSchedulerStore.saveArmedIds(appContext, armed.map { it.id }.toSet())
      }
      else -> {
        cancelScheduledAlarms(idsToCancel)
        WebhookSchedulerStore.saveArmedIds(appContext, emptySet())
        schedulePeriodic(settings.intervalHours)
      }
    }
  }

  fun cancelAll() {
    cancelPeriodic()
    cancelScheduledAlarms(WebhookSchedulerStore.readArmedIds(appContext))
    WebhookSchedulerStore.saveArmedIds(appContext, emptySet())
  }

  fun enqueueImmediate(reason: String, sendTestPayload: Boolean) {
    val request = OneTimeWorkRequestBuilder<WebhookSyncWorker>()
      .setConstraints(syncConstraints())
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
      .setInputData(WebhookSyncWorker.inputData(reason, sendTestPayload))
      .build()

    workManager.enqueueUniqueWork(ONE_TIME_WORK_NAME, ExistingWorkPolicy.REPLACE, request)
  }

  private fun schedulePeriodic(intervalHours: Int) {
    val request = PeriodicWorkRequestBuilder<WebhookSyncWorker>(
      intervalHours.coerceIn(1, 24).toLong(),
      TimeUnit.HOURS,
    )
      .setConstraints(syncConstraints())
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
      .setInputData(WebhookSyncWorker.inputData("INTERVAL", false))
      .build()

    workManager.enqueueUniquePeriodicWork(
      PERIODIC_WORK_NAME,
      ExistingPeriodicWorkPolicy.UPDATE,
      request,
    )
  }

  private fun cancelPeriodic() {
    workManager.cancelUniqueWork(PERIODIC_WORK_NAME)
  }

  private fun scheduleSingleAlarm(time: WebhookScheduledTime) {
    val nextRun = WebhookScheduleArithmetic.nextRunFor(time, LocalDateTime.now())
    val triggerAtMillis = nextRun.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    val pendingIntent = PendingIntent.getBroadcast(
      appContext,
      time.id.hashCode(),
      Intent(appContext, WebhookSyncAlarmReceiver::class.java).apply {
        putExtra(EXTRA_SCHEDULE_ID, time.id)
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val canScheduleExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      alarmManager.canScheduleExactAlarms()
    if (canScheduleExact) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    } else {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    }
  }

  private fun cancelScheduledAlarms(ids: Collection<String>) {
    ids.forEach { id ->
      PendingIntent.getBroadcast(
        appContext,
        id.hashCode(),
        Intent(appContext, WebhookSyncAlarmReceiver::class.java).apply {
          putExtra(EXTRA_SCHEDULE_ID, id)
        },
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
      )?.let { alarmManager.cancel(it) }
    }
  }

  private fun syncConstraints(): Constraints =
    Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()

  companion object {
    const val PERIODIC_WORK_NAME = "unmiser_webhook_periodic_sync"
    const val ONE_TIME_WORK_NAME = "unmiser_webhook_one_time_sync"
    const val EXTRA_SCHEDULE_ID = "unmiser_webhook_schedule_id"
  }
}
