import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface OrderConfirmationProps {
  orderCount: number;
  customerName: string;
  onNewOrder: () => void;
}

export function OrderConfirmation({ orderCount, customerName, onNewOrder }: OrderConfirmationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <CheckCircle2 className="h-20 w-20 mx-auto text-success mb-6" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-2xl font-bold mb-2">Order Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Successfully submitted <span className="font-semibold text-foreground">{orderCount}</span>{" "}
              {orderCount === 1 ? "jersey" : "jerseys"} for{" "}
              <span className="font-semibold text-foreground">{customerName}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Your order is now pending review. Our team will begin production shortly.
            </p>
            <Button onClick={onNewOrder} className="w-full h-12">
              Start New Order
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
