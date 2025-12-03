#!/bin/bash

# Script to add missing CSS styles for experience-description and languages sections
# to all template CSS files

STYLES_DIR="../src/pdf/styles"

# CSS for experience description
EXPERIENCE_DESC_CSS='
.experience-description {
  margin-top: 0.04in;
  margin-bottom: 0.06in;
  font-size: 10pt;
  color: var(--text-secondary, #4a5568);
  line-height: 1.6;
}
'

# CSS for languages section
LANGUAGES_CSS='
/* Languages Section */
.languages-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.08in;
  margin-bottom: 0.1in;
}

.language-item {
  padding: 0.06in 0.1in;
  background: var(--background-light, #f7fafc);
  border-radius: 3pt;
  border-left: 2pt solid var(--primary-color, #1e3a5f);
  page-break-inside: avoid;
}

.language-name {
  font-weight: 600;
  font-size: 10pt;
  color: var(--text-primary, #1a1a1a);
}

.language-level {
  font-size: 9pt;
  color: var(--text-secondary, #4a5568);
  font-style: italic;
}
'

echo "🎨 Updating template CSS files..."

# Find all CSS files in template subdirectories
find "$STYLES_DIR"/*/  -name "*.css" -type f | while read -r css_file; do
  echo "  → Updating: $css_file"
  
  # Check if experience-description already exists
  if ! grep -q "experience-description" "$css_file"; then
    # Find the position after .experience-company and add the new style
    if grep -q "\.experience-company" "$css_file"; then
      # Use awk to insert after the last closing brace of .experience-company
      awk '/\.experience-company/,/^}/ { print; if (/^}/) { print "'"$EXPERIENCE_DESC_CSS"'" } next } 1' "$css_file" > "$css_file.tmp"
      mv "$css_file.tmp" "$css_file"
      echo "    ✓ Added experience-description styles"
    fi
  fi
  
  # Check if languages styles already exist
  if ! grep -q "languages-container" "$css_file"; then
    # Append to the end of the file
    echo "$LANGUAGES_CSS" >> "$css_file"
    echo "    ✓ Added languages section styles"
  fi
done

echo ""
echo "✅ Template CSS files updated successfully!"
