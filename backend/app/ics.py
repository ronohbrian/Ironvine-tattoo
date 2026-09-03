from . import models


def _ics_dt(date: str, time: str) -> str:
    h, m = time.split(":")
    return date.replace("-", "") + "T" + h.zfill(2) + m.zfill(2) + "00"


def generate_ics(appt: "models.Appointment", artist_name: str) -> str:
    h, m = appt.time.split(":")
    end_hour = (int(h) + 2) % 24
    start = _ics_dt(appt.date, appt.time)
    end = appt.date.replace("-", "") + "T" + str(end_hour).zfill(2) + m.zfill(2) + "00"
    uid = f"{appt.id}@ironvine-tattoo"

    description = (
        f"Tattoo session with {artist_name}. Piece: {appt.style}. "
        f"Placement: {appt.placement or 'TBD'}. "
        f"Deposit: ${appt.deposit_amount:.0f} "
        f"({'paid' if appt.deposit_paid else 'unpaid'})."
    )

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ironvine Tattoo//Booking//EN",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{start}",
        f"DTSTART:{start}",
        f"DTEND:{end}",
        f"SUMMARY:Tattoo \u2014 {appt.client_name} with {artist_name}",
        f"DESCRIPTION:{description}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines)
