import json
import re

try:
    with open('data.js', 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Strip JS assignment "const propertyData = " and trailing ";"
    json_str = re.sub(r'^const propertyData = ', '', content)
    json_str = json_str.strip().rstrip(';')
    
    # Attempt parse
    data = json.loads(json_str)
    print("SUCCESS: valid JSON with", len(data), "items")
    
except json.JSONDecodeError as e:
    print(f"ERROR: JSON Syntax Error at line {e.lineno}, column {e.colno}")
    print(f"Message: {e.msg}")
    # Print context
    lines = json_str.splitlines()
    if 0 <= e.lineno - 1 < len(lines):
        print(f"Line content: {lines[e.lineno - 1]}")
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
