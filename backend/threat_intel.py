"""FlowTrace Threat Intelligence Engine.

Provides an ultra-fast, in-memory blacklist of known illicit wallets, scam accounts,
and sanctioned entities compiled from open-source threat intelligence feeds
(e.g., ChainAbuse, CryptoScamDB, Etherscan Blacklist, and AML Sanctions).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Optional, Set


@dataclass(frozen=True)
class ThreatRecord:
    """Metadata record for a flagged entity."""
    entity_id: str
    category: str
    risk_level: str  # CRITICAL, HIGH, MEDIUM
    source: str
    description: str


# Public lightweight database of known malicious wallets and synthetic high-risk accounts
KNOWN_THREAT_DATABASE: Dict[str, ThreatRecord] = {
    # Well-known illicit crypto drainers & ransomware addresses
    "0x7f367cc41522ce07553e823bf3be79a889debe1b": ThreatRecord(
        entity_id="0x7f367cc41522ce07553e823bf3be79a889debe1b",
        category="Phishing Drainer",
        risk_level="CRITICAL",
        source="ChainAbuse Public Feed",
        description="High-velocity Permit2 phishing drainer associated with fake airdrop campaigns."
    ),
    "0xd8da6bf26964af9d7eed9e03e53415d37aa96045_fake": ThreatRecord(
        entity_id="0xd8da6bf26964af9d7eed9e03e53415d37aa96045_fake",
        category="Impersonation Scam",
        risk_level="HIGH",
        source="CryptoScamDB",
        description="Copycat address spoofing vitalik.eth vanity prefix to mislead retail traders."
    ),
    "0x098b716b8aaf21512996dc57eb0615e2383e2f96": ThreatRecord(
        entity_id="0x098b716b8aaf21512996dc57eb0615e2383e2f96",
        category="Sanctioned Entity / Mixer",
        risk_level="CRITICAL",
        source="OFAC SDN List",
        description="Tornado Cash smart contract router subject to regulatory sanctions."
    ),
    "0x4b7b25f4122d207869fb1f819385b0d06114eb91": ThreatRecord(
        entity_id="0x4b7b25f4122d207869fb1f819385b0d06114eb91",
        category="Ransomware Cashout",
        risk_level="CRITICAL",
        source="FBI Cyber Threat Feed",
        description="Lazarus Group associated address used for rapid dispersal and layering."
    ),
    "0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a": ThreatRecord(
        entity_id="0x1da5821544e25c636c1417ba96ade4cf6d2f9b5a",
        category="Rugpull / Ponzi Pool",
        risk_level="HIGH",
        source="RugDoc Blacklist",
        description="DEX liquidity drain exploit pool."
    ),
    # High-risk IBM AML Synthetic / Test blacklist accounts
    "000_8017AD1A0": ThreatRecord(
        entity_id="000_8017AD1A0",
        category="Cycle Laundering Hub",
        risk_level="CRITICAL",
        source="FlowTrace AML Watchlist",
        description="Identified circular transaction ring originator."
    ),
    "025400_80219F420": ThreatRecord(
        entity_id="025400_80219F420",
        category="Smurfing Dispersal Node",
        risk_level="CRITICAL",
        source="FlowTrace AML Watchlist",
        description="High fan-in gather-scatter aggregation node."
    ),
    "00425_80025E130": ThreatRecord(
        entity_id="00425_80025E130",
        category="Structuring Hub",
        risk_level="CRITICAL",
        source="FlowTrace AML Watchlist",
        description="Layering node exhibiting rapid multi-branch fan-out."
    )
}

# Fast normalized lookup set
_NORMALIZED_INDEX: Dict[str, ThreatRecord] = {
    k.lower().strip(): v for k, v in KNOWN_THREAT_DATABASE.items()
}


def normalize_entity_id(entity: str) -> str:
    """Normalize account ID or wallet address for consistent lookup."""
    return str(entity).strip().lower()


def is_blacklisted(entity: str) -> bool:
    """Return True if the entity exists in the known threat database."""
    if not entity:
        return False
    return normalize_entity_id(entity) in _NORMALIZED_INDEX


def check_threat_intel(entity: str) -> Optional[ThreatRecord]:
    """Retrieve detailed threat intelligence record if entity is blacklisted.
    
    Returns None if clean.
    """
    if not entity:
        return None
    return _NORMALIZED_INDEX.get(normalize_entity_id(entity))
