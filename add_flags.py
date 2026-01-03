#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to add country flag emojis to airports.json based on iso_country codes
"""

import json

def country_code_to_flag(country_code):
    """
    Convert ISO 3166-1 alpha-2 country code to flag emoji
    
    Args:
        country_code: Two-letter country code (e.g., 'US', 'GB', 'FR')
    
    Returns:
        Flag emoji string
    """
    if not country_code or len(country_code) != 2:
        return ""
    
    # Convert country code to flag emoji
    # Flag emojis are created by combining Regional Indicator Symbol letters
    # A = U+1F1E6, B = U+1F1E7, etc.
    offset = 127397  # Offset to convert ASCII to Regional Indicator
    flag = ''.join(chr(ord(char) + offset) for char in country_code.upper())
    return flag

def add_flags_to_airports(input_file='airports.json', output_file='airports.json'):
    """
    Read airports.json, add flag emoji field, and save back
    
    Args:
        input_file: Path to input JSON file
        output_file: Path to output JSON file
    """
    print(f"Reading {input_file}...")
    
    # Read the JSON file
    with open(input_file, 'r', encoding='utf-8') as f:
        airports = json.load(f)
    
    print(f"Processing {len(airports)} airports...")
    
    # Add icon field to each airport
    for airport in airports:
        iso_country = airport.get('iso_country', '')
        flag_emoji = country_code_to_flag(iso_country)
        airport['icon'] = flag_emoji
    
    # Write back to file with proper formatting
    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(airports, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Successfully added flag emojis to {len(airports)} airports!")
    
    # Show some examples
    print("\nExamples:")
    for i, airport in enumerate(airports[:5]):
        print(f"  {airport.get('name', 'Unknown')}: {airport.get('iso_country', 'N/A')} → {airport.get('icon', '')}")

if __name__ == '__main__':
    add_flags_to_airports()
