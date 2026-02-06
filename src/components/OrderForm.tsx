import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, User, Hash, Box, ListPlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { calculatePrice } from "@/lib/pricing";

export interface JerseyItem {
  id: string;
  playerNameFront: string;
  playerNameBack: string;
  jerseyNumber: string;
  size: string;
  style: string;
  product: string;
  itemType: "Set" | "Upper" | "Lower";
  price: number;
  customerId?: string;
  customerName: string;
  customerFb?: string;
  customerPhone?: string;
  customerDesign?: File;
}

interface OrderFormProps {
  onAddJersey: (jersey: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">) => void;
  onAddJerseys?: (jerseys: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">[]) => void;
}

const SIZE_GROUPS = [
  {
    label: "Junior Jerseys (4-6)",
    sizes: ["4", "6"]
  },
  {
    label: "Junior Jerseys (8-20)",
    sizes: ["8", "10", "12", "14", "16", "18", "20"]
  },
  {
    label: "Adult Standard",
    sizes: ["2XS", "XS", "S", "M", "L", "XL"]
  },
  {
    label: "Adult Plus Size (2XL-4XL)",
    sizes: ["2XL", "3XL", "4XL"]
  },
  {
    label: "Adult Plus Size (5XL-7XL)",
    sizes: ["5XL", "6XL", "7XL"]
  }
];

const FABRICS = ["Aircool", "Polydex", "Quiana", "Cotton", "Other"];
const PRODUCTS = [
  "Basketball Jersey",
  "Volleyball Jersey",
  "Esports Jersey",
  "Tshirt",
  "Shorts",
  "Hoodie",
  "Longsleeves",
  "Polo Shirt",
  "Pants",
];

export function OrderForm({ onAddJersey, onAddJerseys }: OrderFormProps) {
  const [playerNameFront, setPlayerNameFront] = useState("");
  const [playerNameBack, setPlayerNameBack] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [size, setSize] = useState("M");
  const [style, setStyle] = useState("Polydex");
  const [customStyle, setCustomStyle] = useState("");
  const [product, setProduct] = useState("Basketball Jersey");
  const [itemType, setItemType] = useState<"Set" | "Upper" | "Lower">("Set");
  const [bulkText, setBulkText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerNameBack.trim() || !jerseyNumber.trim()) return;
    if (style === "Other" && !customStyle.trim()) return;

    const itemPrice = calculatePrice(product, itemType, size);

    onAddJersey({
      playerNameFront: playerNameFront.trim(),
      playerNameBack: playerNameBack.trim(),
      jerseyNumber: jerseyNumber.trim(),
      size,
      style: style === "Other" ? customStyle.trim() : style,
      product,
      itemType,
      price: itemPrice,
    });

    // Reset form
    setPlayerNameFront("");
    setPlayerNameBack("");
    setJerseyNumber("");
    setSize("M");
    setStyle("Polydex");
    setCustomStyle("");
  };

  const handleBulkAdd = () => {
    if (!bulkText.trim()) return;

    const lines = bulkText.split("\n");
    const newItems: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">[] = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Format: Name, Number - Size (e.g., John Espinosa, 14 - M)
      // Also supports: Name, Number (uses default size)
      // Regex: captures name until comma, then digits for number, then optionally - for size
      const regex = /^(.+?)[,\s]+(\d+)(?:\s*-\s*(.+))?$/;
      const match = trimmedLine.match(regex);

      if (match) {
        const name = match[1].trim();
        const number = match[2].trim().slice(0, 2);
        const lineSize = match[3] ? match[3].trim().toUpperCase() : size;

        if (name && number) {
          const itemPrice = calculatePrice(product, itemType, lineSize);
          
          newItems.push({
            playerNameFront: "",
            playerNameBack: name,
            jerseyNumber: number,
            size: lineSize,
            style: style === "Other" ? customStyle.trim() : style,
            product,
            itemType,
            price: itemPrice,
          });
        }
      }
    });

    if (newItems.length > 0) {
      if (onAddJerseys) {
        onAddJerseys(newItems);
      } else {
        newItems.forEach(item => onAddJersey(item));
      }
      setBulkText("");
    }
  };

  return (
    <div className="flex flex-col gap-8 items-start">
      {/* Form Section */}
      <Card className="glass-card w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Add Item to Order</CardTitle>
              <CardDescription>Enter details to add to your order batch</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" className="gap-2">
                <User className="h-4 w-4" />
                Single Entry
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <ListPlus className="h-4 w-4" />
                Bulk Add
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="product" className="flex items-center gap-2">
                    <Box className="h-4 w-4 text-muted-foreground" />
                    Product Type
                  </Label>
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Coverage / Type</Label>
                  <Select value={itemType} onValueChange={(v) => setItemType(v as any)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select coverage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Set">Full Set</SelectItem>
                      <SelectItem value="Upper">Upper Only</SelectItem>
                      <SelectItem value="Lower">Lower Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playerNameFront" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Name (Front)
                    </Label>
                    <Input
                      id="playerNameFront"
                      value={playerNameFront}
                      onChange={(e) => setPlayerNameFront(e.target.value)}
                      placeholder="Optional"
                      className="h-11"
                      maxLength={20}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="playerNameBack" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Name (Back)
                    </Label>
                    <Input
                      id="playerNameBack"
                      value={playerNameBack}
                      onChange={(e) => setPlayerNameBack(e.target.value)}
                      placeholder="Required"
                      className="h-11"
                      maxLength={20}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jerseyNumber" className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    Number
                  </Label>
                  <Input
                    id="jerseyNumber"
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="00"
                    className="h-11"
                    maxLength={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Select value={size} onValueChange={setSize}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_GROUPS.map((group) => (
                          <SelectGroup key={group.label}>
                            <SelectLabel>{group.label}</SelectLabel>
                            {group.sizes.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fabric / Style</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FABRICS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <AnimatePresence>
                  {style === "Other" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <Label htmlFor="customStyle">Specify Fabric/Style</Label>
                      <Input
                        id="customStyle"
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        placeholder="Enter custom fabric or style"
                        className="h-11"
                        required
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold"
                  disabled={
                    !playerNameBack.trim() || 
                    !jerseyNumber.trim() || 
                    (style === "Other" && !customStyle.trim())
                  }
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add to Batch
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="bulk" className="space-y-6 pt-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Common Settings</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Fabric / Style" />
                      </SelectTrigger>
                      <SelectContent>
                        {FABRICS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={product} onValueChange={setProduct}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCTS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={itemType} onValueChange={(v) => setItemType(v as any)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Coverage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Set">Full Set</SelectItem>
                        <SelectItem value="Upper">Upper Only</SelectItem>
                        <SelectItem value="Lower">Lower Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <AnimatePresence>
                  {style === "Other" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <Label htmlFor="bulkCustomStyle">Specify Fabric/Style</Label>
                      <Input
                        id="bulkCustomStyle"
                        value={customStyle}
                        onChange={(e) => setCustomStyle(e.target.value)}
                        placeholder="Enter custom fabric or style"
                        className="h-11"
                        required
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <Label htmlFor="bulkText">Paste Names, Numbers & Sizes</Label>
                  <Textarea
                    id="bulkText"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder="John Espinosa, 14 - M&#10;Camila Cordero, 7 - XL&#10;Zagado, 8 - S"
                    className="min-h-[200px] font-mono whitespace-pre"
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: "Name, Number - Size" (one per line)
                  </p>
                </div>

                <Button
                  onClick={handleBulkAdd}
                  className="w-full h-12 text-base font-semibold"
                  disabled={
                    !bulkText.trim() || 
                    (style === "Other" && !customStyle.trim())
                  }
                >
                  <ListPlus className="mr-2 h-5 w-5" />
                  Add Bulk to Batch
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
