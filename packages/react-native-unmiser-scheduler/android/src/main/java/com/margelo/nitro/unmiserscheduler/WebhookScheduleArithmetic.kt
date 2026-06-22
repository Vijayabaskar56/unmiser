package com.margelo.nitro.unmiserscheduler

import java.time.ZonedDateTime

internal object WebhookScheduleArithmetic {
  /**
   * Next firing instant for a daily schedule time, in `now`'s zone. Built from
   * LocalDate + the target wall-clock time via `atZone`, so the zone's DST rules
   * apply: a spring-forward gap (the target hh:mm doesn't exist) shifts forward by
   * the gap instead of silently landing an hour off, and a fall-back overlap
   * resolves to a single offset instead of double-firing. Compares on the instant
   * (not the local time) so "is it still today or already past" is unambiguous
   * across offset changes.
   */
  fun nextRunFor(time: WebhookScheduledTime, now: ZonedDateTime): ZonedDateTime {
    val today = now.toLocalDate().atTime(time.hour, time.minute).atZone(now.zone)
    if (today.toInstant().isAfter(now.toInstant())) return today
    return now.toLocalDate().plusDays(1).atTime(time.hour, time.minute).atZone(now.zone)
  }
}
