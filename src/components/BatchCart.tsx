import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { JerseyPreview } from "./JerseyPreview";
import { Trash2, ShoppingBag, Send } from "lucide-react";
import type { JerseyItem } from "./OrderForm";

interface BatchCartProps {
  items: JerseyItem[];
  onRemoveItem: (id: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
}

export function BatchCart({ items, onRemoveItem, onSubmit, isSubmitting }: BatchCartProps) {
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
              {items.length} {items.length === 1 ? "jersey" : "jerseys"} in batch
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No jerseys added yet</p>
            <p className="text-sm">Add player jerseys to build your batch</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 group"
                >
                  <JerseyPreview
                    playerName={item.playerName}
                    jerseyNumber={item.jerseyNumber}
                    style={item.style}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{item.playerName}</p>
                    <p className="text-sm text-muted-foreground">
                      #{item.jerseyNumber} • {item.size} • {item.style}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
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
                Finalize & Submit Order
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
