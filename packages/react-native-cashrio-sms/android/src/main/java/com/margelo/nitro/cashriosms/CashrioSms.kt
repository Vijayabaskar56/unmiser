package com.margelo.nitro.cashriosms

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.Telephony
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.time.Instant

@Keep
@DoNotStrip
class CashrioSms : HybridCashrioSmsSpec() {
  private var smsListener: ((NativeSmsRecord) -> Unit)? = null
  private var smsReceiver: BroadcastReceiver? = null
  private var listenerPreScreen: Boolean = false

  override fun hasSmsPermissions(): SmsPermissionState {
    val context = requireContext()
    return SmsPermissionState(
      read = context.checkSelfPermission(Manifest.permission.READ_SMS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED,
      receive = context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED,
    )
  }

  override fun requestSmsPermissions(): Promise<SmsPermissionState> {
    val context = requireContext()
    val activity = context.currentActivity
      ?: return Promise.rejected(IllegalStateException("Cannot request SMS permission without an active Activity"))

    if (hasSmsPermissions().read && hasSmsPermissions().receive) {
      return Promise.resolved(hasSmsPermissions())
    }

    val permissionActivity = activity as? PermissionAwareActivity
      ?: return Promise.rejected(IllegalStateException("Current Activity cannot request permissions"))

    val promise = Promise<SmsPermissionState>()
    val permissions = mutableListOf(
      Manifest.permission.READ_SMS,
      Manifest.permission.RECEIVE_SMS,
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      permissions.add(Manifest.permission.POST_NOTIFICATIONS)
    }

    permissionActivity.requestPermissions(
      permissions.toTypedArray(),
      SMS_PERMISSION_REQUEST,
      PermissionListener { requestCode, _, _ ->
        if (requestCode == SMS_PERMISSION_REQUEST) {
          promise.resolve(hasSmsPermissions())
          true
        } else {
          false
        }
      },
    )

    return promise
  }

  override fun getHistoricalSmsCount(): Promise<Double> {
    return Promise.parallel {
      val context = requireContext()
      if (context.checkSelfPermission(Manifest.permission.READ_SMS) !=
        android.content.pm.PackageManager.PERMISSION_GRANTED
      ) {
        throw IllegalStateException("READ_SMS permission is not granted")
      }

      var cursor: Cursor? = null
      try {
        cursor = context.contentResolver.query(
          Uri.parse("content://sms/inbox"),
          arrayOf("_id"),
          null,
          null,
          null,
        )
        (cursor?.count ?: 0).toDouble()
      } finally {
        cursor?.close()
      }
    }
  }

  override fun getHistoricalSmsPage(
    offset: Double,
    limit: Double,
    preScreen: Boolean,
  ): Promise<SmsPageResult> {
    return Promise.parallel {
      val context = requireContext()
      if (context.checkSelfPermission(Manifest.permission.READ_SMS) !=
        android.content.pm.PackageManager.PERMISSION_GRANTED
      ) {
        throw IllegalStateException("READ_SMS permission is not granted")
      }

      val messages = mutableListOf<NativeSmsRecord>()
      val safeOffset = offset.toInt().coerceAtLeast(0)
      val safeLimit = limit.toInt().coerceAtLeast(0)
      val sortOrder = if (safeLimit > 0) {
        "date ASC LIMIT $safeLimit OFFSET $safeOffset"
      } else {
        "date ASC"
      }

      // `scanned` counts every raw row the cursor visits — including rows the
      // pre-screen drops — so JS cursor bookkeeping stays in raw-row space.
      var scanned = 0
      var cursor: Cursor? = null
      try {
        cursor = context.contentResolver.query(
          Uri.parse("content://sms/inbox"),
          arrayOf("address", "body", "date"),
          null,
          null,
          sortOrder,
        )

        while (cursor != null && cursor.moveToNext()) {
          scanned += 1
          val sender = cursor.getString(0) ?: continue
          val body = cursor.getString(1) ?: continue
          if (preScreen && !SmsPreScreen.shouldCapture(sender, body)) continue
          val dateMillis = cursor.getLong(2)
          messages.add(
            NativeSmsRecord(
              sender = sender,
              body = body,
              receivedAt = Instant.ofEpochMilli(dateMillis).toString(),
            ),
          )
        }
      } finally {
        cursor?.close()
      }

      SmsPageResult(records = messages.toTypedArray(), scanned = scanned.toDouble())
    }
  }

  override fun showNotification(title: String, body: String): Promise<Boolean> {
    return Promise.parallel {
      val context = requireContext()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
        android.content.pm.PackageManager.PERMISSION_GRANTED
      ) {
        return@parallel false
      }

      val notificationManager = context.getSystemService(NotificationManager::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
          SMS_NOTIFICATION_CHANNEL,
          "Cashrio SMS",
          NotificationManager.IMPORTANCE_DEFAULT,
        )
        notificationManager.createNotificationChannel(channel)
      }

      val notification = Notification.Builder(context, SMS_NOTIFICATION_CHANNEL)
        .setSmallIcon(android.R.drawable.stat_notify_chat)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(Notification.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .build()

      notificationManager.notify(SMS_NOTIFICATION_ID, notification)
      true
    }
  }

  override fun startSmsListener(onSms: (NativeSmsRecord) -> Unit, preScreen: Boolean) {
    val context = requireContext()
    smsListener = onSms
    listenerPreScreen = preScreen
    if (smsReceiver != null) return

    val receiver = object : BroadcastReceiver() {
      override fun onReceive(receiverContext: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return
        val first = messages.firstOrNull() ?: return
        val sender = first.displayOriginatingAddress ?: return
        // Multipart SMS arrive as several PDUs in one broadcast; join them in order.
        val body = messages.joinToString(separator = "") { it.displayMessageBody ?: "" }
        if (body.isEmpty()) return
        if (listenerPreScreen && !SmsPreScreen.shouldCapture(sender, body)) return
        val record = NativeSmsRecord(
          sender = sender,
          body = body,
          receivedAt = Instant.ofEpochMilli(first.timestampMillis).toString(),
        )
        smsListener?.invoke(record)
      }
    }
    smsReceiver = receiver

    val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      // SMS_RECEIVED is a protected system broadcast, so exporting is safe.
      context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      context.registerReceiver(receiver, filter)
    }
  }

  override fun stopSmsListener() {
    smsListener = null
    listenerPreScreen = false
    val receiver = smsReceiver ?: return
    smsReceiver = null
    try {
      requireContext().unregisterReceiver(receiver)
    } catch (_: IllegalArgumentException) {
      // Receiver was already unregistered (e.g. context torn down) — nothing to do.
    }
  }

  private fun requireContext() =
    NitroModules.applicationContext
      ?: throw IllegalStateException("NitroModules application context is not available")

  companion object {
    private const val SMS_PERMISSION_REQUEST = 7301
    private const val SMS_NOTIFICATION_CHANNEL = "cashrio_sms"
    private const val SMS_NOTIFICATION_ID = 7302
  }
}
