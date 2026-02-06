
export type ProductType = 
  | "Basketball Jersey" 
  | "Volleyball Jersey" 
  | "Esports Jersey" 
  | "Tshirt" 
  | "Shorts" 
  | "Hoodie" 
  | "Longsleeves" 
  | "Polo Shirt"
  | "Pants";

export type ItemType = "Set" | "Upper" | "Lower";

export interface PricingResult {
  price: number;
  category: string;
}

/**
 * Calculate price and determine category based on the sample pricing provided.
 * Note: User mentioned this is sample pricing and will provide correct ones later.
 */
export function getPriceDetails(product: string, itemType: string, size: string): PricingResult {
  const s = size.toUpperCase();
  const p = product;

  // Basketball / Volleyball / Esports Jerseys
  if (p.includes("Jersey")) {
    // Junior Jerseys (4-6)
    if (["4", "6"].includes(s)) {
      const price = itemType === "Set" ? 250 : 150;
      return { price, category: "Junior Jerseys (4-6)" };
    }
    // Junior Jerseys (8-20)
    if (["8", "10", "12", "14", "16", "18", "20"].includes(s)) {
      const price = itemType === "Set" ? 380 : 200;
      return { price, category: "Junior Jerseys (8-20)" };
    }
    
    // Adult sizes
    let basePrice = 280;
    let category = "Adult Standard";
    
    // Add surcharges for plus sizes
    if (["2XL", "3XL", "4XL", "2X-LARGE", "3X-LARGE", "4X-LARGE"].includes(s)) {
      basePrice += 30;
      category = "Adult Plus Size (2XL-4XL)";
    } else if (["5XL", "6XL", "7XL", "5X-LARGE", "6X-LARGE", "7X-LARGE"].includes(s)) {
      basePrice += 50;
      category = "Adult Plus Size (5XL-7XL)";
    }
    
    return { price: basePrice, category };
  }

  // T-shirts, Shorts, Pants, Polo, Longsleeves, Hoodies
  if (["Tshirt", "Shorts", "Pants", "Polo Shirt", "Longsleeves", "Hoodie"].includes(p)) {
    if (["2XS", "XS", "2XSMALL", "XSMALL"].includes(s)) {
      return { price: 280, category: `${p} (S-M Sizes)` };
    }
    if (["S", "M", "L", "SMALL", "MEDIUM", "LARGE"].includes(s)) {
      return { price: 300, category: `${p} (L-XL Sizes)` }; // Following logic of name brackets
    }
    
    let basePrice = 320;
    let category = `${p} (Standard)`;
    
    if (["2XL", "3XL", "4XL", "2X-LARGE", "3X-LARGE", "4X-LARGE"].includes(s)) {
      basePrice += 30;
      category = `${p} (Plus Size 2XL-4XL)`;
    } else if (["5XL", "6XL", "7XL", "5X-LARGE", "6X-LARGE", "7X-LARGE"].includes(s)) {
      basePrice += 50;
      category = `${p} (Plus Size 5XL-7XL)`;
    }
    
    return { price: basePrice, category };
  }

  return { price: 0, category: "Unknown" };
}

/**
 * Backward compatibility for calculatePrice
 */
export function calculatePrice(product: string, itemType: string, size: string): number {
  return getPriceDetails(product, itemType, size).price;
}
