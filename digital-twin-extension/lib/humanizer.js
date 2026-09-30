/**
 * Humanizer Module
 * Simulates human-like response patterns and rate limiting
 */

class Humanizer {
  static calculateResponseDelay(messageLength) {
    // 2-8 seconds based on message length
    const baseDelay = 2000;
    const perCharDelay = (messageLength / 100) * 1000;
    const randomVariance = Math.random() * 2000;
    return Math.min(8000, baseDelay + perCharDelay + randomVariance);
  }

  static calculateTypingDuration(textLength) {
    // ~50-80 WPM = ~8.3-13.3 chars per second
    const charsPerSecond = 10 + Math.random() * 3;
    return (textLength / charsPerSecond) * 1000;
  }

  static isWithinWorkingHours(startHour = 8, endHour = 2) {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (endHour > startHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // Spans midnight (8am-2am = 8 to 26)
      return currentHour >= startHour || currentHour < endHour;
    }
  }
}

class MessageRateLimiter {
  constructor(perHourLimit = 40, per10MinLimit = 12) {
    this.perHourLimit = perHourLimit;
    this.per10MinLimit = per10MinLimit;
    this.lastHourEvents = [];
    this.last10MinEvents = [];
    this.lastMessageTime = 0;
  }

  shouldRespond() {
    const now = Date.now();

    // Cleanup old events
    this.lastHourEvents = this.lastHourEvents.filter(t => now - t < 3600000);
    this.last10MinEvents = this.last10MinEvents.filter(t => now - t < 600000);

    // Check limits
    if (this.lastHourEvents.length >= this.perHourLimit) {
      console.log('Rate limit: hourly limit reached');
      return false;
    }

    if (this.last10MinEvents.length >= this.per10MinLimit) {
      console.log('Rate limit: 10-min limit reached');
      return false;
    }

    // Avoid 3+ consecutive auto-replies (add break)
    const consecutiveReplies = this.last10MinEvents.length;
    if (consecutiveReplies >= 3) {
      const timeSinceLastReply = now - this.lastMessageTime;
      if (timeSinceLastReply < 30000) { // Less than 30s
        console.log('Consecutive replies: taking break');
        return false;
      }
    }

    // Random skip (5% chance of not responding even when allowed)
    if (Math.random() < 0.05) {
      console.log('Random skip activated');
      return false;
    }

    return true;
  }

  recordMessage() {
    const now = Date.now();
    this.lastHourEvents.push(now);
    this.last10MinEvents.push(now);
    this.lastMessageTime = now;
  }

  getStats() {
    const now = Date.now();
    this.lastHourEvents = this.lastHourEvents.filter(t => now - t < 3600000);
    this.last10MinEvents = this.last10MinEvents.filter(t => now - t < 600000);

    return {
      hourly: {
        count: this.lastHourEvents.length,
        limit: this.perHourLimit,
        remaining: Math.max(0, this.perHourLimit - this.lastHourEvents.length)
      },
      tenMin: {
        count: this.last10MinEvents.length,
        limit: this.per10MinLimit,
        remaining: Math.max(0, this.per10MinLimit - this.last10MinEvents.length)
      }
    };
  }
}
