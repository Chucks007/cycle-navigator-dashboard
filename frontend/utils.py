from datetime import datetime
import pytz

def is_market_open():
    """Check if US markets are currently open (9:30 AM - 4:00 PM ET, Mon-Fri)."""
    et = pytz.timezone('US/Eastern')
    now = datetime.now(et)
    
    # Check if weekend
    if now.weekday() >= 5:
        return False
    
    # Check market hours (9:30 AM - 4:00 PM ET)
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    
    return market_open <= now <= market_close

def get_sentiment_emoji(score):
    """Return an emoji based on the sentiment score."""
    if score > 0.1:
        return "🟢"
    elif score < -0.1:
        return "🔴"
    else:
        return "⚪"

