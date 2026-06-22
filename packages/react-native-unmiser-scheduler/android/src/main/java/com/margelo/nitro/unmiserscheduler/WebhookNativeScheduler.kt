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
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

internal class WebhookNativeScheduler(private val context: Context) {
  private val appContext = context.applicationContext
  private val workManager = WorkManager.getInstance(appContext)
  private val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  // apply()/cancelAll() do a read-armed → cancel → arm → save-armed sequence that
  // must be atomic. They run on the Nitro Promise.parallel pool (rapid re-edits)
  // and on the alarm receiver's worker thread (re-apply after fire); without a
  // shared lock two runs interleave, both read the same stale armed set, and
  // alarms armed by the loser are never recorded — they leak and keep firing. A
  // fresh WebhookNativeScheduler is created per call, so the lock must be static.
  fun apply(settings: WebhookScheduleSettings) = synchronized(APPLY_LOCK) {
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

  fun cancelAll() = synchronized(APPLY_LOCK) {
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

    // APPEND_OR_REPLACE, not REPLACE: a back-to-back trigger (two close scheduled
    // times, or "Sync now" while a scheduled sync is queued waiting for network)
    // must chain behind the pending work, not cancel it — REPLACE silently dropped
    // the earlier sync. APPEND_OR_REPLACE still replaces once the chain has run.
    workManager.enqueueUniqueWork(
      ONE_TIME_WORK_NAME,
      ExistingWorkPolicy.APPEND_OR_REPLACE,
      request,
    )
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
    val nextRun = WebhookScheduleArithmetic.nextRunFor(time, ZonedDateTime.now(ZoneId.systemDefault()))
    val triggerAtMillis = nextRun.toInstant().toEpochMilli()
    val pendingIntent = PendingIntent.getBroadcast(
      appContext,
      WebhookSchedulerStore.requestCodeFor(appContext, time.id),
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
        WebhookSchedulerStore.requestCodeFor(appContext, id),
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

    // Shared across all (per-call) scheduler instances so apply()/cancelAll()
    // critical sections never interleave across threads.
    private val APPLY_LOCK = Any()
  }
}
