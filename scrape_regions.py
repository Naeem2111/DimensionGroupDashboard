"""
Scrape architecture practices from Dimension Group target regions:
  - Australia  (ArchitectureAU directory)
  - South Africa (The Business List)
  - UAE (Yellow Pages UAE)
  - Saudi Arabia (Eye of Riyadh directory)

Usage:
  python scrape_regions.py --region all --limit 30
  python scrape_regions.py --region australia,uae --out data/architects-regions.json
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
from typing import Dict, Iterable, List, Optional, Set
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

SOCIAL_HOSTS = frozenset(
    {
        "twitter.com",
        "x.com",
        "instagram.com",
        "facebook.com",
        "fb.com",
        "linkedin.com",
        "youtube.com",
        "pinterest.com",
        "tiktok.com",
        "whatsapp.com",
        "addtoany.com",
    }
)

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)


def _host(url: str) -> str:
    try:
        host = (urlparse(url).netloc or "").lower()
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return ""


def is_social(url: str) -> bool:
    h = _host(url)
    return any(h == s or h.endswith("." + s) for s in SOCIAL_HOSTS)


def clean_email(raw: str, block_hosts: Iterable[str] = ()) -> Optional[str]:
    email = (raw or "").strip().lower()
    if not email or "@" not in email:
        return None
    if any(b in email for b in block_hosts):
        return None
    if email.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg")):
        return None
    return email


def extract_emails(text: str, block_hosts: Iterable[str] = ()) -> List[str]:
    out: List[str] = []
    seen: Set[str] = set()
    for match in EMAIL_RE.findall(text or ""):
        email = clean_email(match, block_hosts)
        if email and email not in seen:
            seen.add(email)
            out.append(email)
    return out


def empty_practice(url: str, name: str, country: str) -> Dict:
    return {
        "url": url,
        "name": name,
        "website": None,
        "socials": [],
        "email": None,
        "address": None,
        "contact": None,
        "phone": None,
        "country": country,
        "description": None,
        "years_active": None,
        "staff": None,
        "awards": [],
    }


class RegionScraper:
    def __init__(self, delay: float = 0.8):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def get(self, url: str, **kwargs) -> requests.Response:
        r = self.session.get(url, timeout=40, **kwargs)
        r.raise_for_status()
        time.sleep(self.delay)
        return r

    def scrape_australia(self, limit: Optional[int] = None) -> List[Dict]:
        country = "Australia"
        listing = "https://architectureau.com/directory/search/?practice_type=Architecture"
        print(f"[{country}] listing {listing}")
        r = self.get(listing)
        soup = BeautifulSoup(r.text, "html.parser")
        urls: List[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if re.match(r"^/directory/[a-z0-9-]+/?$", href) and not any(
                x in href for x in ("/search", "/add", "/favorit")
            ):
                full = urljoin(r.url, href.rstrip("/") + "/")
                if full not in urls:
                    urls.append(full)
        if limit:
            urls = urls[:limit]
        print(f"[{country}] {len(urls)} practice pages")

        practices: List[Dict] = []
        for i, url in enumerate(urls, 1):
            print(f"[{country}] [{i}/{len(urls)}] {url}")
            try:
                practices.append(self._au_detail(url, country))
            except Exception as e:
                print(f"  error: {e}")
                practices.append({**empty_practice(url, url.rstrip("/").split("/")[-1], country), "error": str(e)})
        return practices

    def _au_detail(self, url: str, country: str) -> Dict:
        r = self.get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        name = ""
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(" ", strip=True)
        if not name and soup.title:
            name = soup.title.get_text(strip=True).split("|")[0].strip()
        practice = empty_practice(url, name or "Unknown", country)

        emails = extract_emails(r.text, block_hosts=("architectureau.com", "architecturemedia.com"))
        if emails:
            practice["email"] = emails[0]

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            text = a.get_text(" ", strip=True).lower()
            if href.startswith("mailto:"):
                email = clean_email(href.replace("mailto:", "").split("?")[0], ("architectureau.com",))
                if email:
                    practice["email"] = practice["email"] or email
            elif href.startswith("http") and not is_social(href) and "architectureau.com" not in href:
                if "website" in text or not practice["website"]:
                    # Prefer explicit Website links
                    if "website" in text or practice["website"] is None:
                        if "architecture.com.au" not in href and "design.org.au" not in href:
                            if "website" in text or _host(href):
                                if "website" in text:
                                    practice["website"] = href
                                elif practice["website"] is None and "." in _host(href):
                                    # first plausible external site
                                    practice["website"] = practice["website"] or href

        # Stronger website pick: anchors labeled Website
        for a in soup.find_all("a", href=True):
            if a.get_text(" ", strip=True).lower() == "website" and a["href"].startswith("http"):
                practice["website"] = a["href"]
                break

        desc = soup.select_one("meta[name=description]")
        if desc and desc.get("content"):
            practice["description"] = desc["content"].strip()
        return practice

    def scrape_south_africa(self, limit: Optional[int] = None, max_pages: int = 5) -> List[Dict]:
        country = "South Africa"
        base = "https://thebusinesslist.co.za"
        urls: List[str] = []
        for page in range(1, max_pages + 1):
            listing = f"{base}/architects?page={page}"
            print(f"[{country}] listing {listing}")
            r = self.get(listing)
            soup = BeautifulSoup(r.text, "html.parser")
            page_urls = []
            for card in soup.select(".listing-card"):
                a = card.select_one("a[href*='architects-business']")
                if not a:
                    continue
                full = urljoin(base, a["href"])
                if full not in urls and full not in page_urls:
                    page_urls.append(full)
            if not page_urls:
                break
            # stop if page repeats first page content
            if page > 1 and set(page_urls).issubset(set(urls)):
                break
            urls.extend(page_urls)
            if limit and len(urls) >= limit:
                break
        if limit:
            urls = urls[:limit]
        print(f"[{country}] {len(urls)} practice pages")

        practices: List[Dict] = []
        for i, url in enumerate(urls, 1):
            print(f"[{country}] [{i}/{len(urls)}] {url}")
            try:
                practices.append(self._sa_detail(url, country))
            except Exception as e:
                print(f"  error: {e}")
                practices.append({**empty_practice(url, url.rstrip("/").split("/")[-1], country), "error": str(e)})
        return practices

    def _sa_detail(self, url: str, country: str) -> Dict:
        r = self.get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        name = ""
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(" ", strip=True)
        if not name and soup.title:
            name = soup.title.get_text(strip=True).split("|")[0].strip()
        practice = empty_practice(url, name or "Unknown", country)

        emails = extract_emails(r.text, block_hosts=("thebusinesslist.co.za",))
        if emails:
            practice["email"] = emails[0]

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith("mailto:"):
                email = clean_email(href.replace("mailto:", "").split("?")[0], ("thebusinesslist.co.za",))
                if email and "thebusinesslist" not in email:
                    practice["email"] = email
            elif href.startswith("http") and "businesslist" not in href and not is_social(href):
                if practice["website"] is None:
                    practice["website"] = href
            elif href.startswith("tel:"):
                practice["phone"] = href.replace("tel:", "").strip()

        # address-ish lines
        text = soup.get_text("\n", strip=True)
        for line in text.splitlines():
            if re.search(r"\b\d{4}\b", line) and any(
                c in line.lower() for c in ("street", "road", "avenue", "drive", "rd", "st ", "cape", "johannesburg", "durban", "pretoria")
            ):
                practice["address"] = line.strip()[:200]
                break
        return practice

    def scrape_uae(self, limit: Optional[int] = None) -> List[Dict]:
        country = "United Arab Emirates"
        listing = "https://www.yellowpages-uae.com/uae/architects"
        print(f"[{country}] listing {listing}")
        r = self.get(listing)
        soup = BeautifulSoup(r.text, "html.parser")
        urls: List[str] = []
        for h3 in soup.find_all("h3"):
            name = h3.get_text(" ", strip=True)
            if not name or name.lower() in {"advertise with us", "yellow pages", "popular categories"}:
                continue
            parent = h3.parent
            href = None
            for _ in range(5):
                if not parent:
                    break
                a = parent.find("a", href=True)
                if a and re.search(r"-\d+(\?|$)", a["href"]):
                    href = urljoin(r.url, a["href"])
                    break
                parent = parent.parent
            if href and href not in urls:
                urls.append(href)
        if limit:
            urls = urls[:limit]
        print(f"[{country}] {len(urls)} practice pages")

        practices: List[Dict] = []
        for i, url in enumerate(urls, 1):
            print(f"[{country}] [{i}/{len(urls)}] {url.split('?')[0]}")
            try:
                practices.append(self._uae_detail(url, country))
            except Exception as e:
                print(f"  error: {e}")
                practices.append({**empty_practice(url.split("?")[0], "Unknown", country), "error": str(e)})
        return practices

    def _uae_detail(self, url: str, country: str) -> Dict:
        r = self.get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        name = ""
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(" ", strip=True)
        if not name and soup.title:
            name = soup.title.get_text(strip=True).split("|")[0].strip()
        # strip marketing suffixes
        name = re.split(r"\bin\b|\|", name)[0].strip() or name
        practice = empty_practice(url.split("?")[0], name or "Unknown", country)

        emails = extract_emails(r.text, block_hosts=("yellowpages-uae.com", "yellowpages"))
        if emails:
            practice["email"] = emails[0]

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith("mailto:"):
                email = clean_email(href.replace("mailto:", "").split("?")[0], ("yellowpages",))
                if email:
                    practice["email"] = email
            elif href.startswith("http") and "yellowpages" not in href and not is_social(href):
                if "google.com/maps" in href:
                    continue
                if practice["website"] is None:
                    practice["website"] = href.split("?")[0]

        text = soup.get_text("\n", strip=True)
        for line in text.splitlines():
            m = re.search(r"0\d-\d{7}", line)
            if m:
                practice["phone"] = m.group(0)
                break
        return practice

    def scrape_saudi(self, limit: Optional[int] = None) -> List[Dict]:
        country = "Saudi Arabia"
        listing = "https://www.eyeofriyadh.com/directory/category/50_architectural-engineering"
        print(f"[{country}] listing {listing}")
        r = self.get(listing)
        soup = BeautifulSoup(r.text, "html.parser")
        urls: List[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/directory/details/" in href:
                full = urljoin(r.url, href)
                if full not in urls:
                    urls.append(full)
        if limit:
            urls = urls[:limit]
        print(f"[{country}] {len(urls)} practice pages")

        practices: List[Dict] = []
        for i, url in enumerate(urls, 1):
            print(f"[{country}] [{i}/{len(urls)}] {url}")
            try:
                practices.append(self._saudi_detail(url, country))
            except Exception as e:
                print(f"  error: {e}")
                practices.append({**empty_practice(url, url.rstrip("/").split("/")[-1], country), "error": str(e)})
        return practices

    def _saudi_detail(self, url: str, country: str) -> Dict:
        r = self.get(url)
        soup = BeautifulSoup(r.text, "html.parser")
        name = ""
        h1 = soup.find("h1")
        if h1:
            name = h1.get_text(" ", strip=True)
        if not name and soup.title:
            name = soup.title.get_text(strip=True).split("-")[0].strip()
        practice = empty_practice(url, name or "Unknown", country)

        emails = extract_emails(r.text, block_hosts=("eyeofriyadh.com",))
        if emails:
            practice["email"] = emails[0]

        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith("mailto:"):
                email = clean_email(href.replace("mailto:", "").split("?")[0], ("eyeofriyadh.com",))
                if email:
                    practice["email"] = email
            elif href.startswith("http") and "eyeofriyadh" not in href and not is_social(href):
                host = _host(href)
                if host and host not in {"emaar.com", "microsoft.com", "saudiairlines.com", "chamber.sa", "mt.gov.sa", "roshn.sa"}:
                    if practice["website"] is None:
                        practice["website"] = href
        return practice


def save_json(data: List[Dict], path: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(data)} practices -> {path}")


def save_csv(data: List[Dict], path: str) -> None:
    if not data:
        return
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    rows = []
    for row in data:
        r = dict(row)
        if isinstance(r.get("socials"), list):
            r["socials"] = json.dumps(r["socials"])
        if isinstance(r.get("awards"), list):
            r["awards"] = json.dumps(r["awards"])
        rows.append(r)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved CSV -> {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape multi-region architecture directories")
    parser.add_argument(
        "--region",
        default="all",
        help="Comma list: australia,south_africa,uae,saudi,all",
    )
    parser.add_argument("--limit", type=int, default=30, help="Max practices per region")
    parser.add_argument("--delay", type=float, default=0.75)
    parser.add_argument("--out", default="data/architects-regions.json")
    parser.add_argument("--csv", default=None)
    args = parser.parse_args()

    regions = [r.strip().lower() for r in args.region.split(",") if r.strip()]
    if "all" in regions:
        regions = ["australia", "south_africa", "uae", "saudi"]

    scraper = RegionScraper(delay=args.delay)
    all_practices: List[Dict] = []

    for region in regions:
        if region in {"australia", "au"}:
            all_practices.extend(scraper.scrape_australia(limit=args.limit))
        elif region in {"south_africa", "sa", "za"}:
            all_practices.extend(scraper.scrape_south_africa(limit=args.limit))
        elif region in {"uae", "united_arab_emirates"}:
            all_practices.extend(scraper.scrape_uae(limit=args.limit))
        elif region in {"saudi", "saudi_arabia", "ksa"}:
            all_practices.extend(scraper.scrape_saudi(limit=args.limit))
        else:
            print(f"Unknown region: {region}")

    # Prefer contactable leads when summarizing
    with_email = sum(1 for p in all_practices if p.get("email"))
    with_web = sum(1 for p in all_practices if p.get("website"))
    by_country: Dict[str, int] = {}
    for p in all_practices:
        by_country[p.get("country") or "?"] = by_country.get(p.get("country") or "?", 0) + 1

    save_json(all_practices, args.out)
    csv_path = args.csv or (args.out[:-5] + ".csv" if args.out.endswith(".json") else None)
    if csv_path:
        save_csv(all_practices, csv_path)

    print("=" * 50)
    print(f"Done. total={len(all_practices)} with_email={with_email} with_website={with_web}")
    print("by country:", by_country)
    print("=" * 50)


if __name__ == "__main__":
    main()
