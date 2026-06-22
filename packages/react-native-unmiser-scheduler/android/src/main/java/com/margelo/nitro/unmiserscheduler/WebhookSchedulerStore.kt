package com.margelo.nitro.unmiserscheduler

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

internal data class WebhookScheduledTime(
  val id: String,
  val hour: Int,
  val minute: Int,
  val enabled: Boolean,
)

internal data class WebhookScheduleSettings(
  val syncMode: String,
  val intervalHours: Int,
  val scheduledTimes: List<WebhookScheduledTime>,
)

internal object WebhookSchedulerStore {
  private const val PREFS = "unmiser_webhook_scheduler"
  private const val KEY_SETTINGS_JSON = "settings_json"
  private const val KEY_ARMED_IDS_JSON = "armed_ids_json"
  private const val KEY_PENDING_TRIGGERS_JSON = "pending_triggers_json"
  private const val KEY_REQUEST_CODES_JSON = "request_codes_json"
  // PendingIntent request codes start above 0 so a code is never confused with a
  // default/empty value.
  private const val REQUEST_CODE_BASE = 1000

  fun saveSettings(context: Context, settingsJson: String) {
    prefs(context).edit().putString(KEY_SETTINGS_JSON, settingsJson).apply()
  }

  fun readSettingsJson(context: Context): String? =
    prefs(context).getString(KEY_SETTINGS_JSON, null)

  fun readSettings(context: Context): WebhookScheduleSettings? =
    readSettingsJson(context)?.let(::parseSettings)

  fun clearSettings(context: Context) {
    prefs(context).edit()
      .remove(KEY_SETTINGS_JSON)
      .remove(KEY_ARMED_IDS_JSON)
      .apply()
  }

  fun saveArmedIds(context: Context, ids: Set<String>) {
    prefs(context).edit().putString(KEY_ARMED_IDS_JSON, JSONArray(ids.toList()).toString()).apply()
  }

  fun readArmedIds(context: Context): Set<String> {
    val raw = prefs(context).getString(KEY_ARMED_IDS_JSON, null) ?: return emptySet()
    return runCatching {
      val array = JSONArray(raw)
      buildSet {
        for (i in 0 until array.length()) add(array.getString(i))
      }
    }.getOrDefault(emptySet())
  }

  // appendTrigger (WorkManager/alarm worker threads) and consumeTriggers (JS/Nitro
  // thread) both read-modify-write the same key; without a lock an append during a
  // consume is clobbered, or already-consumed triggers are resurrected. Serialize
  // the read-modify-write on the singleton, and commit() synchronously so the next
  // lock holder sees the write.
  @Synchronized
  fun appendTrigger(context: Context, reason: String, sendTestPayload: Boolean) {
    val prefs = prefs(context)
    val array = JSONArray(prefs.getString(KEY_PENDING_TRIGGERS_JSON, "[]"))
    array.put(
      JSONObject()
        .put("id", UUID.randomUUID().toString())
        .put("reason", reason)
        .put("sendTestPayload", sendTestPayload)
        .put("createdAt", Instant.now().toString()),
    )
    prefs.edit().putString(KEY_PENDING_TRIGGERS_JSON, array.toString()).commit()
  }

  @Synchronized
  fun consumeTriggers(context: Context): String {
    val prefs = prefs(context)
    val pending = prefs.getString(KEY_PENDING_TRIGGERS_JSON, "[]") ?: "[]"
    prefs.edit().putString(KEY_PENDING_TRIGGERS_JSON, "[]").commit()
    return pending
  }

  /**
   * Stable, collision-free PendingIntent request code for a schedule id. Allocated
   * once per id and persisted, so arming and cancelling always agree and two
   * distinct ids can never share a code (unlike `id.hashCode()`, which collides).
   */
  @Synchronized
  fun requestCodeFor(context: Context, id: String): Int {
    val prefs = prefs(context)
    val map = runCatching { JSONObject(prefs.getString(KEY_REQUEST_CODES_JSON, "{}") ?: "{}") }
      .getOrDefault(JSONObject())
    if (map.has(id)) return map.getInt(id)
    var next = REQUEST_CODE_BASE
    val keys = map.keys()
    while (keys.hasNext()) {
      val code = map.getInt(keys.next())
      if (code >= next) next = code + 1
    }
    map.put(id, next)
    prefs.edit().putString(KEY_REQUEST_CODES_JSON, map.toString()).commit()
    return next
  }

  fun parseSettings(settingsJson: String): WebhookScheduleSettings {
    val json = JSONObject(settingsJson)
    val times = json.optJSONArray("scheduledTimes") ?: JSONArray()
    return WebhookScheduleSettings(
      syncMode = json.optString("syncMode", "INTERVAL"),
      intervalHours = json.optInt("intervalHours", 6),
      scheduledTimes = buildList {
        for (i in 0 until times.length()) {
          val item = times.getJSONObject(i)
          add(
            WebhookScheduledTime(
              id = item.optString("id", UUID.randomUUID().toString()),
              hour = item.optInt("hour", 0).coerceIn(0, 23),
              minute = item.optInt("minute", 0).coerceIn(0, 59),
              enabled = item.optBoolean("enabled", true),
            ),
          )
        }
      },
    )
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
