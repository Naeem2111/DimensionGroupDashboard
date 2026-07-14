"""
Test script to verify the scraper works with a small sample
"""
from scrape_architects import ArchitectScraper

def main():
    """Test the scraper with a small sample."""
    scraper = ArchitectScraper(delay=1.0)
    
    print("Testing URL extraction...")
    print("=" * 50)
    
    # Test getting URLs from first page
    test_urls = scraper.get_all_architect_urls(
        "https://architectdirectory.co.uk/architects/",
        max_pages=1
    )
    
    print(f"\nFound {len(test_urls)} practice URLs on first page")
    print("\nSample URLs:")
    for url in test_urls[:5]:
        print(f"  - {url}")
    
    if test_urls:
        print(f"\n{'=' * 50}")
        print("Testing practice page scraping...")
        print("=" * 50)
        
        # Test scraping one practice page
        test_url = test_urls[0]
        print(f"\nScraping: {test_url}")
        practice_data = scraper.scrape_practice_page(test_url)
        
        print("\nExtracted data:")
        print(f"  Name: {practice_data.get('name', 'N/A')}")
        print(f"  Website: {practice_data.get('website', 'N/A')}")
        print(f"  Email: {practice_data.get('email', 'N/A')}")
        print(f"  Address: {practice_data.get('address', 'N/A')}")
        print(f"  Contact: {practice_data.get('contact', 'N/A')}")
        print(f"  Description: {practice_data.get('description', 'N/A')[:150]}...")
        print(f"  Years Active: {practice_data.get('years_active', 'N/A')}")
        print(f"  Staff: {practice_data.get('staff', 'N/A')}")
        
        print(f"\n{'=' * 50}")
        print("Test completed successfully!")
        print("You can now run the full scraper with: python scrape_architects.py")
    else:
        print("\nNo URLs found. Please check the website structure.")

if __name__ == "__main__":
    main()
