package com.margelo.nitro.unmiserscheduler

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

@Keep
@DoNotStrip
class UnmiserScheduler : HybridUnmiserSchedulerSpec() {
  override fun applyWebhookSchedule(settingsJson: String): Promise<Unit> {
    return Promise.parallel {
      val context = requireContext()
      val settings = WebhookSchedulerStore.parseSettings(settingsJson)
      WebhookSchedulerStore.saveSettings(context, settingsJson)
      WebhookNativeScheduler(context).apply(settings)
    }
  }

  override fun cancelWebhookSchedule() {
    val context = requireContext()
    WebhookNativeScheduler(context).cancelAll()
    WebhookSchedulerStore.clearSettings(context)
  }

  override fun enqueueWebhookSync(reason: WebhookSyncReason, sendTestPayload: Boolean) {
    WebhookNativeScheduler(requireContext()).enqueueImmediate(reason.name, sendTestPayload)
  }

  override fun consumePendingWebhookTriggers(): String {
    return WebhookSchedulerStore.consumeTriggers(requireContext())
  }

  private fun requireContext() =
    NitroModules.applicationContext
      ?: throw IllegalStateException("NitroModules application context is not available")
}
