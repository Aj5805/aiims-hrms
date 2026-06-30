"""AIIMS Bibinagar closed (gazetted) and restricted holidays — calendar year 2026.

Source: Office Order AIIMS/BBN/Admin/Holiday/OO/2025/472 dated 03 Nov 2025
        (https://aiimsbibinagar.edu.in/pdf/AIIMS_BBN_Admin_Holiday_OO_2025_472.pdf)

Amendments applied:
  - Id-ul-Zuha (Bakrid): 28 May 2026 per OO/867 dated 25 May 2026 (was 27 May in annexure)
  - Dr. B.R. Ambedkar Jayanti: 14 Apr 2026 closed holiday per OO/2026/775 dated 11 Apr 2026

holiday_type values match holiday_master: GAZETTED (closed) | RESTRICTED
"""

HOLIDAY_YEAR = 2026

# (ISO date, name, type)
AIIMS_HOLIDAYS_2026: list[tuple[str, str, str]] = [
    # ── Annexure-I: Closed holidays ──────────────────────────────────────
    ("2026-01-14", "Makar Sankranti / Magha Bihu / Pongal", "GAZETTED"),
    ("2026-01-26", "Republic Day", "GAZETTED"),
    ("2026-03-04", "Holi", "GAZETTED"),
    ("2026-03-21", "Id-ul-Fitr", "GAZETTED"),
    ("2026-03-31", "Mahavir Jayanti", "GAZETTED"),
    ("2026-04-03", "Good Friday", "GAZETTED"),
    ("2026-04-14", "Birthday of Dr. B.R. Ambedkar", "GAZETTED"),
    ("2026-05-01", "Budha Purnima", "GAZETTED"),
    ("2026-05-28", "Id-ul-Zuha (Bakrid)", "GAZETTED"),
    ("2026-06-26", "Muharram", "GAZETTED"),
    ("2026-08-15", "Independence Day", "GAZETTED"),
    ("2026-08-26", "Milad-un-Nabi (Id-e-Milad)", "GAZETTED"),
    ("2026-09-14", "Ganesh Chaturthi / Vinayaka Chaturthi", "GAZETTED"),
    ("2026-10-02", "Mahatma Gandhi's Birthday", "GAZETTED"),
    ("2026-10-20", "Dussehra", "GAZETTED"),
    ("2026-11-08", "Diwali (Deepavali)", "GAZETTED"),
    ("2026-11-24", "Guru Nanak's Birthday", "GAZETTED"),
    ("2026-12-25", "Christmas Day", "GAZETTED"),
    # ── Annexure-II: Restricted holidays ─────────────────────────────────
    ("2026-01-01", "New Year's Day", "RESTRICTED"),
    ("2026-01-03", "Hazarat Ali's Birthday", "RESTRICTED"),
    ("2026-01-23", "Sri Panchami / Basant Panchami", "RESTRICTED"),
    ("2026-02-01", "Guru Gobind Singh's Birthday", "RESTRICTED"),
    ("2026-02-12", "Birthday of Swamy Dayananda Saraswati", "RESTRICTED"),
    ("2026-02-15", "Maha Shivratri", "RESTRICTED"),
    ("2026-02-19", "Shivaji Jayanti", "RESTRICTED"),
    ("2026-03-03", "Holika Dahan / Dolyatra", "RESTRICTED"),
    ("2026-03-19", "Chaitra Sukladi / Gudi Padava / Ugadi / Cheti Chand", "RESTRICTED"),
    ("2026-03-20", "Jamat-Ul-Vida", "RESTRICTED"),
    ("2026-04-05", "Easter Sunday", "RESTRICTED"),
    ("2026-04-14", "Vaisakhi / Vishu / Meshadi (Tamil New Year's Day)", "RESTRICTED"),
    ("2026-04-15", "Vaisakhadi (Bengal) / Bahag Bihu (Assam)", "RESTRICTED"),
    ("2026-05-09", "Birthday of Rabindranath Tagore", "RESTRICTED"),
    ("2026-07-16", "Rath Yatra", "RESTRICTED"),
    ("2026-08-15", "Parsi New Year's Day / Nauraz", "RESTRICTED"),
    ("2026-08-26", "Onam or Thiru Onam Day", "RESTRICTED"),
    ("2026-08-28", "Raksha Bandhan", "RESTRICTED"),
    ("2026-10-18", "Dussehra (Saptami)", "RESTRICTED"),
    ("2026-10-19", "Dussehra (Mahashtami)", "RESTRICTED"),
    ("2026-10-20", "Dussehra (Mahanavmi)", "RESTRICTED"),
    ("2026-10-26", "Maharishi Valmiki's Birthday", "RESTRICTED"),
    ("2026-10-29", "Karaka Chaturthi (Karwa Chouth)", "RESTRICTED"),
    ("2026-11-08", "Naraka Chaturdasi", "RESTRICTED"),
    ("2026-11-09", "Govardhan Puja", "RESTRICTED"),
    ("2026-11-11", "Bhai Duj", "RESTRICTED"),
    ("2026-11-15", "Pratihar Shashthi / Surya Shashthi (Chhat Puja)", "RESTRICTED"),
    ("2026-11-24", "Guru Teg Bahadur's Martyrdom Day", "RESTRICTED"),
    ("2026-12-24", "Christmas Eve", "RESTRICTED"),
]
