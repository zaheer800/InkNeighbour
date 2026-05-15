-- Minimum order value above which delivery is waived.
-- NULL = always charge delivery. Value in paise (e.g. 50000 = ₹500).
-- Applies to both home owners (flat fee) and print shops (tiered fee).
ALTER TABLE owners ADD COLUMN IF NOT EXISTS free_delivery_above INTEGER;
