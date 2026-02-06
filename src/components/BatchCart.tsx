import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Trash2, ShoppingBag, Send, User } from "lucide-react";
import type { JerseyItem } from "./OrderForm";
import { useMemo } from "react";

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
                    <User className="h-3 w-3" />
                    {customerItems[0].customerName}
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
                        <p className="font-semibold truncate">
                          {item.playerNameBack}
                          {item.playerNameFront && (
                            <span className="text-muted-foreground font-normal ml-1">
                              ({item.playerNameFront})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {item.product} • #{item.jerseyNumber} • {item.size} • {item.style}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
