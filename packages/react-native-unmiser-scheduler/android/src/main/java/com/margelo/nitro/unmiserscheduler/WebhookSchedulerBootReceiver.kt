package com.margelo.nitro.unmiserscheduler

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class WebhookSchedulerBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
    val pendingResult = goAsync()
    Thread {
      try {
        val scheduler = WebhookNativeScheduler(context.applicationContext)
        WebhookSchedulerStore.readSettings(context)?.let(scheduler::apply)
      } catch (t: Throwable) {
        Log.e(TAG, "Failed to re-apply webhook schedule after boot", t)
      } finally {
        pendingResult.finish()
      }
    }.start()
  }

  companion object {
    private const val TAG = "WebhookSchedulerBoot"
  }
}
