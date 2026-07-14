"""
Script to scrape all architect information from architectdirectory.co.uk
"""
import requests
from bs4 import BeautifulSoup
import json
import csv
import time
import re
from urllib.parse import urljoin, urlparse
from typing import List, Dict, Optional

BASE_URL = "https://architectdirectory.co.uk"
ARCHITECTS_URL = f"{BASE_URL}/architects/"
LANDSCAPE_ARCHITECTS_URL = f"{BASE_URL}/landscape-architects/"  # ~130 results, all pages scraped

# Hosts we should not treat as the practice "website" (use actual site, not socials)
SOCIAL_OR_NON_WEBSITE_HOSTS = frozenset({
    'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
    'instagram.com', 'www.instagram.com',
    'facebook.com', 'www.facebook.com', 'fb.com', 'www.fb.com',
    'linkedin.com', 'www.linkedin.com',
    'youtube.com', 'www.youtube.com',
    'pinterest.com', 'www.pinterest.com',
    'tiktok.com', 'www.tiktok.com',
})


def _is_social_or_non_website(href: str) -> bool:
    """Return True if href is a social/media link we should not use as the practice website."""
    if not href or not href.startswith('http'):
        return True
    try:
        parsed = urlparse(href)
        host = (parsed.netloc or '').lower().strip()
        if not host or 'architectdirectory.co.uk' in host:
            return True
        # Strip leading 'www.' for comparison
        host_normalized = host[4:] if host.startswith('www.') else host
        if host_normalized in SOCIAL_OR_NON_WEBSITE_HOSTS:
            return True
        if host in SOCIAL_OR_NON_WEBSITE_HOSTS:
            return True
        return False
    except Exception:
        return True


def _is_social_url(href: str) -> bool:
    """Return True if href is a known social/media URL we want to store in socials."""
    if not href or not href.startswith('http'):
        return False
    try:
        parsed = urlparse(href)
        host = (parsed.netloc or '').lower().strip()
        if not host or 'architectdirectory.co.uk' in host:
            return False
        host_normalized = host[4:] if host.startswith('www.') else host
        return host_normalized in SOCIAL_OR_NON_WEBSITE_HOSTS or host in SOCIAL_OR_NON_WEBSITE_HOSTS
    except Exception:
        return False

class ArchitectScraper:
    def __init__(self, delay: float = 1.0):
        """
        Initialize the scraper with a delay between requests to be respectful.
        
        Args:
            delay: Seconds to wait between requests
        """
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def get_all_architect_urls(self, url: str, max_pages: Optional[int] = None) -> List[str]:
        """
        Extract all architect practice URLs from the listing pages.
        Tries multiple pagination URL formats until no new URLs are found.
        
        Args:
            url: The base listing URL (e.g. .../architects/ or .../landscape-architects/)
            max_pages: Maximum number of pages to scrape (None = no limit, stop when empty)
        
        Returns:
            List of practice URLs
        """
        practice_urls = set()
        seen_urls = set()
        page = 1
        empty_page_count = 0
        max_empty_before_stop = 2  # Stop after 2 consecutive pages with 0 new URLs
        safety_max_pages = 400  # Hard cap to avoid infinite loop
        
        # Site uses ?p=N for page number and &ipp=50 for 50 results per page
        base_url_clean = url.split('?')[0].rstrip('/')
        ipp = 50  # items per page
        
        while page <= safety_max_pages:
            if page == 1:
                page_url = f"{base_url_clean}/?ipp={ipp}"
            else:
                page_url = f"{base_url_clean}/?p={page}&ipp={ipp}"
            
            print(f"Fetching page {page}... ({page_url})")
            try:
                response = self.session.get(page_url, timeout=15)
                response.raise_for_status()
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Find all practice links
                practice_links = soup.find_all('a', href=re.compile(r'/practice/[^/]+/?$'))
                if not practice_links:
                    practice_links = soup.find_all('a', href=lambda x: x and '/practice/' in str(x))
                if not practice_links:
                    for elem in soup.find_all(['li', 'div', 'article']):
                        link = elem.find('a', href=re.compile(r'/practice/'))
                        if link:
                            practice_links.append(link)
                
                page_urls = []
                for link in practice_links:
                    href = link.get('href', '')
                    if href and '/practice/' in href:
                        href = href.split('?')[0].split('#')[0]
                        if not href.startswith('http'):
                            href = urljoin(BASE_URL, href)
                        href = href.rstrip('/')
                        if href not in seen_urls:
                            seen_urls.add(href)
                            page_urls.append(href)
                            practice_urls.add(href)
                
                print(f"Found {len(page_urls)} new practices on page {page} (Total: {len(practice_urls)})")
                
                if len(page_urls) == 0:
                    empty_page_count += 1
                    if empty_page_count >= max_empty_before_stop:
                        print("No more new practices on recent pages. Stopping.")
                        break
                else:
                    empty_page_count = 0
                
                if max_pages and page >= max_pages:
                    break
                
                page += 1
                time.sleep(self.delay)
                
            except requests.RequestException as e:
                print(f"Error fetching page {page}: {e}")
                # If page 2+ fails, retry with same format once
                if page > 1:
                    alt_url = f"{base_url_clean}/?p={page}&ipp={ipp}"
                    print(f"Retrying: {alt_url}")
                    try:
                        response = self.session.get(alt_url, timeout=15)
                        response.raise_for_status()
                        soup = BeautifulSoup(response.content, 'html.parser')
                        practice_links = soup.find_all('a', href=re.compile(r'/practice/'))
                        for link in practice_links:
                            href = link.get('href', '')
                            if href and '/practice/' in href:
                                href = href.split('?')[0].split('#')[0]
                                if not href.startswith('http'):
                                    href = urljoin(BASE_URL, href)
                                href = href.rstrip('/')
                                if href not in seen_urls:
                                    seen_urls.add(href)
                                    practice_urls.add(href)
                        page += 1
                        time.sleep(self.delay)
                        continue
                    except Exception:
                        pass
                break
        
        return sorted(list(practice_urls))
    
    def scrape_practice_page(self, url: str) -> Dict:
        """
        Scrape detailed information from a practice page.
        
        Args:
            url: URL of the practice page
        
        Returns:
            Dictionary containing practice information
        """
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            
            practice_data = {
                'url': url,
                'name': '',
                'website': '',
                'socials': [],
                'email': '',
                'address': '',
                'contact': '',
                'description': '',
                'years_active': '',
                'staff': '',
                'awards': []
            }
            
            # Extract practice name from URL
            # URL pattern: /practice/practice-name/ -> "Practice Name"
            url_path = urlparse(url).path
            if '/practice/' in url_path:
                practice_slug = url_path.split('/practice/')[-1].rstrip('/')
                # Convert slug to readable name: "hugh-broughton-architects" -> "Hugh Broughton Architects"
                practice_data['name'] = practice_slug.replace('-', ' ').title()
            
            # Fallback: Extract from h1 or h2 if URL extraction fails
            if not practice_data['name']:
                h1 = soup.find('h1')
                h2 = soup.find('h2')
                if h1:
                    practice_data['name'] = h1.get_text(strip=True)
                elif h2:
                    practice_data['name'] = h2.get_text(strip=True)
            
            # Extract description from description__copy-wrapper (main content only)
            main_content = soup.find('main') or soup.find('article')
            search_root = main_content if main_content else soup
            copy_wrapper = search_root.find(class_=re.compile(r'description__copy-wrapper'))
            
            if copy_wrapper:
                # Get all text from paragraphs inside the copy wrapper (exclude link text)
                description_parts = []
                for p in copy_wrapper.find_all('p'):
                    para_text = p.get_text(strip=True)
                    if para_text and len(para_text) > 10:
                        # Skip if it's just a link label
                        if para_text.lower() not in ('website', 'email', 'back to results'):
                            para_text = para_text.replace('\u2002', ' ').replace('\u00a0', ' ')
                            para_text = re.sub(r'\s+', ' ', para_text).strip()
                            if para_text and para_text not in description_parts:
                                description_parts.append(para_text)
                # If no <p> tags, get all text (strip out "Website" "Email" etc.)
                if not description_parts:
                    full_text = copy_wrapper.get_text(separator=' ')
                    full_text = re.sub(r'\s+', ' ', full_text).strip()
                    for skip in ('Website', 'Email', 'Back to Results'):
                        full_text = full_text.replace(skip, '')
                    full_text = re.sub(r'\s+', ' ', full_text).strip()
                    if len(full_text) > 20:
                        description_parts.append(full_text)
                practice_data['description'] = ' '.join(description_parts).strip()
            else:
                practice_data['description'] = ''
            
            # Extract address, contact, email from description__contacts; website from
            # description__contacts OR description__copy-wrapper (same practice section in main)
            contacts_block = search_root.find(class_=re.compile(r'description__contacts'))
            
            if contacts_block:
                block_text = contacts_block.get_text()
                
                # Address: text after "Address" within this block
                addr_match = re.search(r'Address\s+([^\n]+?)(?=\s*Contact|\s*$)', block_text, re.I | re.DOTALL)
                if addr_match:
                    addr = addr_match.group(1).strip()
                    addr = ' '.join(addr.split())
                    if len(addr) > 5:
                        practice_data['address'] = addr
                
                # Contact name: link text of mailto link that looks like a name (no @)
                for link in contacts_block.find_all('a', href=re.compile(r'mailto:')):
                    link_text = link.get_text(strip=True)
                    if link_text and '@' not in link_text and len(link_text) > 1:
                        practice_data['contact'] = link_text
                        break
                
                # Email: mailto href from this block only; never use directory domain
                for link in contacts_block.find_all('a', href=re.compile(r'mailto:')):
                    href = link.get('href', '')
                    if 'mailto:' in href:
                        email = href.replace('mailto:', '').strip()
                        if email and 'architectdirectory.co.uk' not in email.lower():
                            practice_data['email'] = email
                            break
                
                # Website: from contacts block first (skip Twitter, Instagram, etc.)
                # Socials: collect any social URLs from the same block
                seen_socials = set()
                for link in contacts_block.find_all('a', href=True):
                    href = link.get('href', '').strip()
                    if not href.startswith('http'):
                        continue
                    if _is_social_url(href) and href not in seen_socials:
                        seen_socials.add(href)
                        practice_data['socials'].append(href)
                    elif not _is_social_or_non_website(href):
                        practice_data['website'] = href
                        break
            
            # Website and socials often in description__copy-wrapper too
            if copy_wrapper:
                seen_socials = set(practice_data['socials'])
                for link in copy_wrapper.find_all('a', href=True):
                    href = link.get('href', '').strip()
                    if not href.startswith('http'):
                        continue
                    if _is_social_url(href) and href not in seen_socials:
                        seen_socials.add(href)
                        practice_data['socials'].append(href)
                    elif not practice_data['website'] and not _is_social_or_non_website(href):
                        practice_data['website'] = href
            
            # Extract structured data from the page
            all_text = soup.get_text()
            
            # Extract years active - pattern: "Years active\n27(Avg 21)" or "Years active\n33 (Avg 21)"
            years_match = re.search(r'Years active[:\s]*\n?\s*(\d+)\s*\(?Avg', all_text, re.I)
            if years_match:
                practice_data['years_active'] = years_match.group(1).strip()
            else:
                # Fallback: get any number after "Years active"
                years_match = re.search(r'Years active[:\s]*\n?\s*(\d+)', all_text, re.I)
                if years_match:
                    practice_data['years_active'] = years_match.group(1).strip()
            
            # Extract staff: try multiple strategies for "Professional staff" value
            staff_value = ''
            
            # Strategy 1: Find element whose text is exactly "Professional staff", then next sibling
            for elem in soup.find_all(string=re.compile(r'^\s*Professional staff\s*$', re.I)):
                parent = elem.parent
                if parent:
                    next_elem = parent.find_next_sibling()
                    if next_elem:
                        text = next_elem.get_text(strip=True)
                        if re.match(r'^[\d\s\-+]+$', text):  # e.g. "0 - 4" or "5 - 19"
                            staff_value = ' '.join(text.split())
                            break
                    if staff_value:
                        break
            
            # Strategy 2: Find any element containing "Professional staff", then next element in DOM
            if not staff_value:
                for elem in soup.find_all(string=re.compile(r'Professional staff', re.I)):
                    parent = elem.parent
                    if parent:
                        # Next sibling of parent
                        n = parent.find_next_sibling()
                        if n:
                            text = n.get_text(strip=True)
                            if re.match(r'^[\d\s\-+]+$', text):
                                staff_value = ' '.join(text.split())
                                break
                        # Or next element in document order
                        for _ in range(5):
                            n = parent.find_next()
                            if not n:
                                break
                            text = n.get_text(strip=True)
                            if re.match(r'^[\d\s\-+]+$', text) and len(text) < 20:
                                staff_value = ' '.join(text.split())
                                break
                            parent = n
                    if staff_value:
                        break
            
            # Strategy 3: Regex on page text - "Professional staff" then value on same or next line
            if not staff_value:
                staff_match = re.search(
                    r'Professional staff\s*[:\n]\s*([\d\s\-+]+?)(?=\s*(?:Percent|Professional|Profile|Staff|$))',
                    all_text, re.I | re.DOTALL
                )
                if staff_match:
                    staff_value = staff_match.group(1).strip()
                    staff_value = re.sub(r'\s*\(Avg[^)]*\)', '', staff_value).strip()
                    staff_value = ' '.join(staff_value.split())
            
            practice_data['staff'] = staff_value
            
            return practice_data
            
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return {'url': url, 'error': str(e)}
    
    def scrape_all(self, include_landscape: bool = True, max_practices: Optional[int] = None) -> List[Dict]:
        """
        Scrape all architects and optionally landscape architects.
        
        Args:
            include_landscape: Whether to include landscape architects
            max_practices: Maximum number of practices to scrape (None for all)
        
        Returns:
            List of practice data dictionaries
        """
        all_practices = []
        
        # Scrape regular architects (all pages)
        print("=" * 50)
        print("Scraping architects (all pages)...")
        print("=" * 50)
        architect_urls = self.get_all_architect_urls(ARCHITECTS_URL)
        print(f"\nFound {len(architect_urls)} architect practice URLs")
        
        all_urls = list(architect_urls)
        
        if include_landscape:
            print("\n" + "=" * 50)
            print("Scraping landscape architects (all pages)...")
            print("=" * 50)
            landscape_urls = self.get_all_architect_urls(LANDSCAPE_ARCHITECTS_URL)
            print(f"\nFound {len(landscape_urls)} landscape architect practice URLs")
            # Deduplicate: same practice may appear in both lists
            seen = set(all_urls)
            for u in landscape_urls:
                if u not in seen:
                    seen.add(u)
                    all_urls.append(u)
            print(f"Combined unique practices: {len(all_urls)}")
        
        architect_urls = all_urls
        total_urls = len(architect_urls)
        if max_practices:
            architect_urls = architect_urls[:max_practices]
            total_urls = len(architect_urls)
        
        print(f"\n{'=' * 50}")
        print(f"Scraping {total_urls} practice pages (target: 2000+)...")
        print(f"{'=' * 50}\n")
        
        for i, url in enumerate(architect_urls, 1):
            print(f"[{i}/{total_urls}] Scraping: {url}")
            practice_data = self.scrape_practice_page(url)
            all_practices.append(practice_data)
            time.sleep(self.delay)
        
        return all_practices
    
    def save_to_json(self, data: List[Dict], filename: str = 'architects.json'):
        """Save data to JSON file."""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"\nData saved to {filename}")
    
    def save_to_csv(self, data: List[Dict], filename: str = 'architects.csv'):
        """Save data to CSV file."""
        if not data:
            return
        # Serialize list columns for CSV (socials, awards)
        rows = []
        for row in data:
            r = dict(row)
            if isinstance(r.get('socials'), list):
                r['socials'] = json.dumps(r['socials'])
            if isinstance(r.get('awards'), list):
                r['awards'] = json.dumps(r['awards'])
            rows.append(r)
        fieldnames = rows[0].keys()
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"Data saved to {filename}")


def main():
    """Main function to run the scraper."""
    scraper = ArchitectScraper(delay=1.0)  # 1 second delay between requests
    
    # Scrape all architects (you can set max_practices for testing)
    practices = scraper.scrape_all(include_landscape=True, max_practices=None)
    
    # Save to both JSON and CSV
    scraper.save_to_json(practices, 'architects.json')
    scraper.save_to_csv(practices, 'architects.csv')
    
    print(f"\n{'=' * 50}")
    print(f"Scraping complete! Found {len(practices)} practices.")
    if len(practices) < 2000:
        print(f"Note: Expected 2000+ records. Check that all listing pages were scraped.")
    else:
        print(f"Target of 2000+ records met.")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
