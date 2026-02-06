import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Trash2, ShoppingBag, Send, User, Tag } from "lucide-react";
import type { JerseyItem } from "./OrderForm";
import { useMemo } from "react";
import { getPriceDetails } from "@/lib/pricing";

interface BatchCartProps {
  items: JerseyItem[];
  onRemoveItem: (id: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export function BatchCart({ items, onRemoveItem, onSubmit, isSubmitting }: BatchCartProps) {
  const groupedItems = useMemo(() => {
    const groups: Record<string, JerseyItem[]> = {};
    items.forEach((item) => {
      const key = `${item.customerName}-${item.customerPhone || ""}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [items]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0);
  }, [items]);

  return (
    <Card className="glass-card sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Current Batch
            </CardTitle>
            <CardDescription>
              {items.length} {items.length === 1 ? "item" : "items"} in batch
            </CardDescription>
          </div>
          {total > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Bill</p>
              <p className="text-xl font-bold text-primary">₱{total.toLocaleString()}</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No items added yet</p>
            <p className="text-sm">Add custom items to build your batch</p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            <AnimatePresence mode="popLayout">
              {Object.entries(groupedItems).map(([customerKey, customerItems]) => (
                <div key={customerKey} className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-sm font-bold text-primary border-b pb-1">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{customerItems[0].customerName}</span>
                  </div>
                  {customerItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          {item.playerNameFront ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-bold text-primary flex items-center gap-1">
                                <span className="text-[9px] uppercase text-muted-foreground opacity-70 font-bold whitespace-nowrap">Front:</span> {item.playerNameFront}
                              </span>
                              <span className="font-semibold text-foreground flex items-center gap-1">
                                <span className="text-[9px] uppercase text-muted-foreground opacity-70 font-bold whitespace-nowrap">Back:</span> {item.playerNameBack}
                              </span>
                            </div>
                          ) : (
                            <span className="font-bold text-primary flex items-center gap-1">
                              <span className="text-[9px] uppercase text-muted-foreground opacity-70 font-bold whitespace-nowrap">Back:</span> {item.playerNameBack}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.product} • {item.itemType} • #{item.jerseyNumber} • {item.size} • {item.style}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <Tag className="h-2 w-2 text-primary" />
                          <span className="text-[9px] uppercase font-bold text-primary/70 tracking-tighter">
                            {getPriceDetails(item.product, item.itemType, item.size).category}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <p className="text-sm font-bold text-primary">₱{(item.price || 0).toLocaleString()}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRemoveItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
      {items.length > 0 && (
        <CardFooter className="border-t pt-4">
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full h-12 text-base font-semibold"
          >
            {isSubmitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full"
              />
            ) : (
              <>
                <Send className="mr-2 h-5 w-5" />
                Finalize & Submit Batch
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
