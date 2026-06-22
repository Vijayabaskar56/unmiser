package com.margelo.nitro.unmiserscheduler

import java.time.LocalDateTime

internal object WebhookScheduleArithmetic {
  fun nextRunFor(time: WebhookScheduledTime, now: LocalDateTime): LocalDateTime {
    var next = now.withHour(time.hour).withMinute(time.minute).withSecond(0).withNano(0)
    if (!next.isAfter(now)) {
      next = next.plusDays(1)
    }
    return next
  }
}
