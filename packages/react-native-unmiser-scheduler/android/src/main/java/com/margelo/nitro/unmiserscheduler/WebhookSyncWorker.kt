package com.margelo.nitro.unmiserscheduler

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters

class WebhookSyncWorker(
  appContext: Context,
  workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
  override suspend fun doWork(): Result {
    val reason = inputData.getString(KEY_REASON) ?: "INTERVAL"
    val sendTestPayload = inputData.getBoolean(KEY_SEND_TEST, false)
    WebhookSchedulerStore.appendTrigger(applicationContext, reason, sendTestPayload)
    return Result.success()
  }

  companion object {
    private const val KEY_REASON = "reason"
    private const val KEY_SEND_TEST = "send_test"

    fun inputData(reason: String, sendTestPayload: Boolean): Data =
      Data.Builder()
        .putString(KEY_REASON, reason)
        .putBoolean(KEY_SEND_TEST, sendTestPayload)
        .build()
  }
}
