#!/usr/bin/env python3
"""
Add @map("snake_case") annotations to every camelCase scalar field in prisma/schema.prisma.
This ensures DB columns are snake_case (Postgres convention), matching the SQL migrations.
"""
import re
from pathlib import Path

SCHEMA_PATH = Path(__file__).parent.parent / "prisma" / "schema.prisma"

def camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    s1 = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', name)
    s2 = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s1)
    return s2.lower()

def is_camel_case(name: str) -> bool:
    """True if name has an uppercase letter after the first char."""
    return any(c.isupper() for c in name[1:])

def process_field(line: str) -> str:
    """If line is a camelCase scalar field without @map, add @map("snake_case")."""
    stripped = line.strip()
    if not stripped or stripped.startswith('//') or stripped.startswith('@@') or stripped.startswith('@'):
        return line
    if '@map(' in line:
        return line

    # Match: indent + fieldName + type + rest
    # Preserve original indentation
    m = re.match(r'^(\s+)(\w+)\s+(\S+)(.*)$', line.rstrip())
    if not m:
        return line

    indent, field_name, field_type, rest = m.groups()

    # Skip if not camelCase
    if not is_camel_case(field_name):
        return line

    # Skip relation fields — they reference other model types (capitalized, not in scalar set)
    scalar_types = {'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'Decimal', 'BigInt'}
    base_type = field_type.rstrip('?[]')
    if base_type == 'Unsupported':
        pass  # Allow Unsupported — it's a scalar
    elif base_type not in scalar_types:
        return line  # It's a relation field

    snake = camel_to_snake(field_name)
    if snake == field_name:
        return line

    # Build the new line. Place @map after the existing attributes.
    # rest contains everything after the type (including @db, @default, etc.)
    # We want to add @map at the end of the attributes, before any // comment
    if '//' in rest:
        # Split at // (comment)
        idx = rest.find('//')
        attrs = rest[:idx].rstrip()
        comment = rest[idx:]
    else:
        attrs = rest.rstrip()
        comment = ''

    # Add @map
    if attrs:
        new_attrs = f'{attrs} @map("{snake}")'
    else:
        new_attrs = f'@map("{snake}")'

    # Reconstruct the line with proper spacing
    new_line = f"{indent}{field_name} {field_type} {new_attrs}"
    if comment:
        new_line = f"{new_line} {comment}"

    return new_line

def main():
    content = SCHEMA_PATH.read_text()
    lines = content.split('\n')
    new_lines = [process_field(line) for line in lines]
    new_content = '\n'.join(new_lines)
    SCHEMA_PATH.write_text(new_content)
    print(f"✅ Updated {SCHEMA_PATH}")

    changes = sum(1 for old, new in zip(lines, new_lines) if old != new)
    print(f"   Added @map to {changes} fields")

if __name__ == "__main__":
    main()
