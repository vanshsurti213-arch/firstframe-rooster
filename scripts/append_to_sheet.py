import sys
import os
import json
from datetime import datetime

try:
    import gspread
    from google.oauth2.service_account import Credentials
except ImportError:
    print("❌ Missing dependencies. Run: pip3 install gspread google-auth")
    sys.exit(1)

# ─── Configuration ───────────────────────────────────────────────────────────
CREDENTIALS_FILE = "credentials.json"
DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1u7TMvfn4do5dh79moo1vwgnjo3pl0nhtb6fkhki6e80"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

def get_sheet_id_from_url(url):
    parts = url.split("/")
    for i, part in enumerate(parts):
        if part == "d" and i + 1 < len(parts):
            # Sheet IDs are case-sensitive, but let's keep the exact ID
            return parts[i + 1]
    return None

def main():
    if len(sys.argv) < 2 or sys.argv[1] == "-":
        creator_str = sys.stdin.read()
        sheet_url = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SHEET_URL
    else:
        creator_str = sys.argv[1]
        sheet_url = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SHEET_URL

    try:
        data = json.loads(creator_str)
        if isinstance(data, list):
            creators_list = data
        else:
            creators_list = [data]
    except Exception as e:
        print(f"❌ Failed to parse creator JSON: {e}")
        sys.exit(1)

    # Resolve credentials file path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    creds_path = os.path.join(project_root, CREDENTIALS_FILE)

    if not os.path.exists(creds_path):
        creds_path = CREDENTIALS_FILE

    if not os.path.exists(creds_path):
        print(f"❌ Credentials file '{CREDENTIALS_FILE}' not found!")
        sys.exit(1)

    try:
        creds = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
        gc = gspread.authorize(creds)
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        sys.exit(1)

    # Force exact sheet ID from the user's screenshot if default URL is used
    sheet_id = "1u7TMvFN4Do5dH79MoO1vWGNJo3PL0nHTB6fKhki6e80" if sheet_url == DEFAULT_SHEET_URL else get_sheet_id_from_url(sheet_url)
    if not sheet_id:
        print("❌ Could not extract Sheet ID from URL.")
        sys.exit(1)

    try:
        spreadsheet = gc.open_by_key(sheet_id)
    except Exception as e:
        print(f"❌ Sheet not found or access denied: {e}")
        print("   Make sure the Google Sheet is shared with the service account email.")
        sys.exit(1)

    worksheet_name = "Campaign Creators"
    try:
        ws = spreadsheet.worksheet(worksheet_name)
    except gspread.exceptions.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=3)
        ws.append_row([
            "Full Name",
            "Instagram Handle",
            "Niche"
        ])
        ws.format("A1:C1", {
            "backgroundColor": {"red": 0.05, "green": 0.05, "blue": 0.15},
            "textFormat": {
                "bold": True,
                "fontSize": 11,
                "foregroundColor": {"red": 1, "green": 1, "blue": 1},
            },
            "horizontalAlignment": "CENTER",
        })
        ws.freeze(rows=1)

    rows_to_append = []
    for creator in creators_list:
        name = creator.get("name", "Unknown")
        handle = creator.get("handle", "")
        
        niches_list = creator.get("niches", [])
        niches = ", ".join(niches_list) if isinstance(niches_list, list) else str(niches_list)

        rows_to_append.append([
            name,
            handle,
            niches
        ])

    try:
        ws.append_rows(rows_to_append)
        print(f"✅ Successfully added {len(rows_to_append)} creators to campaign sheet!")
    except Exception as e:
        print(f"❌ Failed to append rows: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
