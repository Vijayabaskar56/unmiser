package com.margelo.nitro.unmiserscheduler

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class WebhookSyncAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val pendingResult = goAsync()
    Thread {
      try {
        val scheduler = WebhookNativeScheduler(context.applicationContext)
        try {
          scheduler.enqueueImmediate("SCHEDULED", false)
        } catch (t: Throwable) {
          Log.e(TAG, "Failed to enqueue scheduled webhook sync", t)
        }
        try {
          WebhookSchedulerStore.readSettings(context)?.let(scheduler::apply)
        } catch (t: Throwable) {
          Log.e(TAG, "Failed to re-apply webhook schedule after alarm", t)
        }
      } finally {
        pendingResult.finish()
      }
    }.start()
  }

  companion object {
    private const val TAG = "WebhookSyncAlarm"
  }
}
