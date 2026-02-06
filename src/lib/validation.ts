import { z } from "zod";

/**
 * Validation schemas for customer and order input data.
 * Enforces format, length, and character restrictions to prevent
 * database pollution and injection attacks.
 */

export const customerSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(1, "Team/customer name is required")
    .max(200, "Name must be 200 characters or less"),
  fbLink: z
    .string()
    .trim()
    .max(500, "Facebook link must be 500 characters or less")
    .refine(
      (val) => val === "" || /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.com|m\.facebook\.com)\/.+/i.test(val) || /^[a-zA-Z0-9._-]+$/i.test(val),
      "Please enter a valid Facebook profile link or username"
    )
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number must be 30 characters or less")
    .refine(
      (val) => val === "" || /^(09|\+639)\d{9}$/.test(val.replace(/[\s-]/g, "")),
      "Please enter a valid PH phone number (e.g., 09XX XXX XXXX)"
    )
    .optional()
    .or(z.literal("")),
});

export const jerseyItemSchema = z.object({
  playerNameBack: z
    .string()
    .trim()
    .min(1, "Player name (back) is required")
    .max(100, "Player name must be 100 characters or less"),
  playerNameFront: z
    .string()
    .trim()
    .max(100, "Player name (front) must be 100 characters or less")
    .optional()
    .or(z.literal("")),
  jerseyNumber: z
    .string()
    .trim()
    .min(1, "Jersey number is required")
    .max(10, "Jersey number must be 10 characters or less"),
  size: z.string().min(1, "Size is required"),
  style: z.string().min(1, "Style is required"),
  product: z.string().min(1, "Product type is required"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type JerseyItemInput = z.infer<typeof jerseyItemSchema>;
