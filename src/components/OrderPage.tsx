import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { CustomerInfo } from "@/components/CustomerInfo";
import { OrderForm, type JerseyItem } from "@/components/OrderForm";
import { BatchCart } from "@/components/BatchCart";
import { OrderConfirmation } from "@/components/OrderConfirmation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Link2, AlertCircle } from "lucide-react";
import { Badge } from "./ui/badge";

interface OrderPageProps {
  onSuccess?: () => void;
  initialCustomerData?: {
    id?: string;
    team_name: string;
    fb_link: string | null;
    contact_phone: string | null;
  };
}

export function OrderPage({ onSuccess, initialCustomerData }: OrderPageProps) {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | undefined>(initialCustomerData?.id);
  const [customerName, setCustomerName] = useState("");
  const [fbLink, setFbLink] = useState("");
  const [phone, setPhone] = useState("");
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [jerseys, setJerseys] = useState<JerseyItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    if (initialCustomerData) {
      setCurrentCustomerId(initialCustomerData.id);
      setCustomerName(initialCustomerData.team_name || "");
      setFbLink(initialCustomerData.fb_link || "");
      setPhone(initialCustomerData.contact_phone || "");
    }
  }, [initialCustomerData]);

  useEffect(() => {
    // If not prefilled, we might want to clear local state if coming from a null state
    if (!initialCustomerData) {
      setCurrentCustomerId(undefined);
      setCustomerName("");
      setFbLink("");
      setPhone("");
    }
  }, [initialCustomerData === null]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAddJersey = (jersey: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">) => {
    if (!customerName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a customer name above first",
        variant: "destructive",
      });
      return;
    }

    const newJersey: JerseyItem = {
      ...jersey,
      id: uuidv4(),
      customerId: currentCustomerId,
      customerName: customerName.trim(),
      customerFb: fbLink.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      customerDesign: designFile || undefined,
    };
    setJerseys((prev) => [...prev, newJersey]);
    toast({
      title: "Item Added",
      description: `${jersey.product} for ${jersey.playerNameBack} added to batch`,
    });
  };

  const handleAddJerseys = (newJerseys: Omit<JerseyItem, "id" | "customerName" | "customerFb" | "customerPhone">[]) => {
    if (!customerName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a customer name above first",
        variant: "destructive",
      });
      return;
    }

    const processedJerseys = newJerseys.map(jersey => ({
      ...jersey,
      id: uuidv4(),
      customerId: currentCustomerId,
      customerName: customerName.trim(),
      customerFb: fbLink.trim() || undefined,
      customerPhone: phone.trim() || undefined,
      customerDesign: designFile || undefined,
    }));

    setJerseys((prev) => [...prev, ...processedJerseys]);
    toast({
      title: "Bulk Add Complete",
      description: `Successfully added ${newJerseys.length} items to batch`,
    });
  };

  const handleRemoveJersey = (id: string) => {
    setJerseys((prev) => prev.filter((j) => j.id !== id));
  };

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      toast({
        title: "Customer Name Required",
        description: "Please enter a customer name",
        variant: "destructive",
      });
      return;
    }

    if (jerseys.length === 0) {
      toast({
        title: "No Items",
        description: "Please add at least one item to your batch",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const customerBatches = new Map<string, {         id?: string;        name: string, 
        fb: string, 
        phone: string, 
        design: File | null,
        items: JerseyItem[] 
      }>();

      jerseys.forEach((j) => {
        const key = j.customerId || `${j.customerName}-${j.customerFb}-${j.customerPhone}`;
        if (!customerBatches.has(key)) {
          customerBatches.set(key, {
            id: j.customerId,
            name: j.customerName,
            fb: j.customerFb || "",
            phone: j.customerPhone || "",
            design: j.customerDesign || null,
            items: [],
          });
        }
        customerBatches.get(key)!.items.push(j);
      });

      for (const [_, customerData] of Array.from(customerBatches)) {
        let designUrl = null;

        if (customerData.design) {
          const fileExt = customerData.design.name.split('.').pop();
          const fileName = `${uuidv4()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('designs')
            .upload(fileName, customerData.design);

          if (uploadError) throw uploadError;
          designUrl = fileName;
        }

        let customerId = customerData.id;

        // If we don't have an ID, try to find an existing customer with this name for this reseller
        if (!customerId) {
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("team_name", customerData.name)
            .eq("reseller_id", user?.id)
            .limit(1)
            .maybeSingle();
          
          if (existing) {
            customerId = existing.id;
          }
        }

        if (!customerId) {
          const { data: customer, error: customerError } = await supabase
            .from("customers")
            .insert({
              team_name: customerData.name,
              fb_link: customerData.fb,
              contact_phone: customerData.phone,
              design_url: designUrl,
              reseller_id: user?.id || null,
            })
            .select()
            .single();

          if (customerError) throw customerError;
          customerId = customer.id;
        } else if (designUrl) {
          // If customer exists but we uploaded a new design, update it
          await supabase
            .from("customers")
            .update({ design_url: designUrl })
            .eq("id", customerId);
        }

        const orders = customerData.items.map((item) => ({
          customer_id: customerId,
          player_name_front: item.playerNameFront,
          player_name_back: item.playerNameBack || "",
          jersey_number: item.jerseyNumber,
          size: item.size,
          style: item.style,
          product_type: item.product,
          item_type: item.itemType,
          price: item.price,
          status: "pending" as const,
        }));

        const { error: ordersError } = await supabase.from("orders").insert(orders);
        if (ordersError) throw ordersError;
      }

      setSubmittedCount(jerseys.length);
      setShowConfirmation(true);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Order submission error:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearCustomer = () => {
    setCurrentCustomerId(undefined);
    setCustomerName("");
    setFbLink("");
    setPhone("");
    setDesignFile(null);
    toast({
      title: "Form Cleared",
      description: "You can now enter details for another person",
    });
  };

  const handleNewOrder = () => {
    setCurrentCustomerId(undefined);
    setCustomerName("");
    setFbLink("");
    setPhone("");
    setDesignFile(null);
    setJerseys([]);
    setShowConfirmation(false);
    setSubmittedCount(0);
  };

  if (showConfirmation) {
    return (
      <OrderConfirmation 
        orderCount={submittedCount} 
        customerName={customerName || "Your Team"}
        onNewOrder={handleNewOrder} 
      />
    );
  }

  return (
    <div className="space-y-8">
      {currentCustomerId && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/5 border border-primary/10 p-4 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-tight">Adding to Existing Profile</p>
              <p className="text-xs text-muted-foreground">Orders will be automatically linked to <span className="text-primary font-bold">{customerName}</span></p>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-none text-[10px] uppercase font-bold px-3 py-1">
            Linked Mode
          </Badge>
        </motion.div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CustomerInfo
              customerName={customerName}
              fbLink={fbLink}
              phone={phone}
              designFile={designFile}
              onCustomerNameChange={setCustomerName}
              onFbLinkChange={setFbLink}
              onPhoneChange={setPhone}
              onDesignFileChange={setDesignFile}
              onClear={handleClearCustomer}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <OrderForm 
              onAddJersey={handleAddJersey} 
              onAddJerseys={handleAddJerseys}
            />
          </motion.div>
        </div>

        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="sticky top-24"
          >
            <BatchCart 
              items={jerseys} 
              onRemoveItem={handleRemoveJersey}
              onSubmit={handleSubmitOrder}
              isSubmitting={isSubmitting}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
