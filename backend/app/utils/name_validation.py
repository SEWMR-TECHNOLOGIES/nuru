# utils/name_validation.py
# Validates user names to prevent fake/sample names while allowing business names

import re

# Common fake/sample/placeholder names (lowercase)
BLOCKED_NAMES = {
    # Generic test/sample names
    "test", "tester", "testing", "testuser", "testaccount",
    "user", "username", "newuser", "sampleuser", "demouser",
    "sample", "demo", "example", "dummy", "fake", "none",
    "admin", "administrator", "root", "superuser", "sysadmin",
    "null", "undefined", "unknown", "anonymous", "anon",
    "guest", "visitor", "temp", "temporary", "tmp",
    "name", "firstname", "lastname", "first", "last",
    "hello", "hi", "hey", "hola", "bye",
    "aaa", "bbb", "ccc", "ddd", "eee", "fff", "ggg", "hhh",
    "iii", "jjj", "kkk", "lll", "mmm", "nnn", "ooo", "ppp",
    "qqq", "rrr", "sss", "ttt", "uuu", "vvv", "www", "xxx",
    "yyy", "zzz",
    "abc", "xyz", "qwerty", "asdf", "asdfgh", "qwer", "zxcv",
    "foo", "bar", "baz", "foobar",
    "johndoe", "janedoe",
    "placeholder", "default", "noname", "no_name", "n/a", "na",
    "noreply", "noemail", "nobody",
    "account", "profile", "myname", "yourname", "thename",
    "real", "realname", "myreal",
    "customer", "client", "member",
    "person", "human", "someone", "anybody",
    "jina", "majina", "mtu",  # Swahili for name/names/person
}

# Blocked first+last name combinations (lowercase)
BLOCKED_NAME_COMBOS = {
    ("john", "doe"),
    ("jane", "doe"),
    ("juan", "perez"),
    ("fulano", "tal"),
}

# Patterns that indicate fake names
FAKE_PATTERNS = [
    r'^(.)\1{2,}$',           # Repeated single char: aaa, bbb
    r'^[a-z]{1,2}$',          # Too short: a, ab
    r'^[0-9]+$',              # All digits
    r'^[^a-zA-Z]+$',          # No letters at all
    r'^(.{1,2})\1{2,}$',     # Repeated short patterns: abababab
    r'^[qwertasdfgzxcvb]{5,}$',  # Keyboard smash (left hand) - min 5 to avoid short real names
    r'^[yuiophjklnm]{5,}$',      # Keyboard smash (right hand) - min 5 to avoid short real names
    r'^test\d*$',             # test123, test1, etc.
    r'^user\d*$',             # user123, user1, etc.
    r'^sample\d*$',           # sample123
    r'^demo\d*$',             # demo123
    r'^fake\d*$',             # fake123
    r'^dummy\d*$',            # dummy123
    r'^temp\d*$',             # temp123
    r'^x{2,}$',               # xx, xxx, xxxx
]


def validate_name(name: str) -> dict:
    """
    Validates a first or last name individually.
    Returns: {"valid": bool, "reason": str | None}
    """
    if not name or not name.strip():
        return {"valid": False, "reason": "Name is required"}
    
    clean = name.strip()
    
    if len(clean) < 2:
        return {"valid": False, "reason": "Name must be at least 2 characters"}
    
    if len(clean) > 50:
        return {"valid": False, "reason": "Name must be 50 characters or less"}
    
    lower = clean.lower().replace(" ", "").replace("_", "").replace("-", "")
    
    # Check blocklist
    if lower in BLOCKED_NAMES:
        return {"valid": False, "reason": f"'{clean}' appears to be a placeholder name. Please use your real name"}
    
    # Check fake patterns
    for pattern in FAKE_PATTERNS:
        if re.fullmatch(pattern, lower):
            return {"valid": False, "reason": f"'{clean}' does not appear to be a valid name. Please use your real name"}
    
    # Must contain at least one letter
    if not re.search(r'[a-zA-Z\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4E00-\u9FFF]', clean):
        return {"valid": False, "reason": "Name must contain at least one letter"}
    
    return {"valid": True, "reason": None}


def validate_name_combo(first_name: str, last_name: str) -> dict:
    """
    Validates a first+last name combination.
    Returns: {"valid": bool, "reason": str | None}
    
    Call this AFTER individual validate_name() checks pass.
    Rejects known fake combos like "John Doe" or "Jane Doe".
    """
    if not first_name or not last_name:
        return {"valid": True, "reason": None}
    
    combo = (
        first_name.strip().lower().replace(" ", ""),
        last_name.strip().lower().replace(" ", ""),
    )
    
    if combo in BLOCKED_NAME_COMBOS:
        return {
            "valid": False,
            "reason": f"'{first_name.strip()} {last_name.strip()}' appears to be a placeholder name. Please use your real name",
        }
    
    return {"valid": True, "reason": None}
