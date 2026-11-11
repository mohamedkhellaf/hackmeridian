# core/calendar

Calendar entries for exercise deadlines (brief D17). Nothing settles by itself, so the purchase receipt and the
position page offer a calendar file. It is generated in the page; no server learns which option the user holds.
Import from `core/calendar` (the index) or `core/calendar/ics`.

| Export | What it does |
|---|---|
| `buildDeadlineIcs({ title, description, expiryTs, url?, uid?, nowTs? })` | A valid `.ics` string (RFC 5545): one event covering the last two hours before `expiryTs`, with alarms 48 h and 2 h before the deadline. Throws `RangeError` when `expiryTs` is not a whole timestamp. |
| `googleCalendarUrl({ title, description, expiryTs, url? })` | The same event as a Google Calendar template link. |
| `deadlineIcsFileName(expiryTs)` | `stellsec-deadline-20261113.ics`. |
| `ICS_MIME_TYPE`, `ICS_PRODID` | `text/calendar;charset=utf-8` and the product id. |
| `icsDateTime(ts)`, `escapeIcsText(text)`, `foldIcsLine(line)` | The building blocks: UTC date-time, TEXT escaping, folding at 75 octets. |
| Type | `DeadlineEvent`. |

Notes for callers:

- The alarms are durations from the event start (`-PT46H` and `PT0S`), which equal 48 h and 2 h before the end.
  Some calendars ignore end-relative triggers, and some keep only the first alarm, so the 48 h one comes first.
- Calendars may drop alarms on import. The event itself is the reminder: it sits in the last two hours.
- The entry is static. The description should say it does not update if the option is sold or exercised.
- Only `http` and `https` links are written. The link is also appended to the description.
- Opening the Google link sends the title and description to Google. Offer it as a choice; never load it.
