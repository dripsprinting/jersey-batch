import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { OrderPage } from "@/components/OrderPage";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { 
  Search, LogOut, Filter, RefreshCw, 
  Package, Clock, Truck, CheckCircle2, 
  LayoutDashboard, Receipt, ChevronRight, Plus, User as UserIcon,
  Users, BookOpen, Settings, ShoppingCart, Upload, ImageIcon, BadgeDollarSign, Trash2,
  Phone, MessageCircle, Tag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { calculatePrice, getPriceDetails } from "@/lib/pricing";

interface OrderWithCustomer {
  id: string;
  player_name_front: string | null;
  player_name_back: string;
  jersey_number: string;
  product_type: string;
  item_type?: string;
  size: string;
  style: string;
  status: string;
  created_at: string;
  price?: number;
  _designSignedUrl?: string | null;
  customers: {
    id: string;
    team_name: string;
    fb_link: string | null;
    contact_phone: string | null;
    design_url: string | null;
    reseller_id: string | null;
  } | null;
}

function extractFilePath(designUrl: string): string {
  if (!designUrl) return "";
  // If it's a full Supabase storage URL, extract the path after /designs/
  const match = /\/storage\/v1\/object\/(?:public|sign)\/designs\/(.+)/.exec(designUrl);
  if (match) return match[1];
  // Otherwise assume it's already a file path
  return designUrl;
}

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "status-pending" },
  in_production: { label: "In Production", icon: Package, color: "status-in_production" },
  shipped: { label: "Shipped", icon: Truck, color: "status-shipped" },
  completed: { label: "Completed", icon: CheckCircle2, color: "status-completed" },
};

export default function Reseller() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txProofUrls, setTxProofUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"orders" | "balance" | "catalog" | "customers" | "settings" | "new_order">("orders");
  const [prefilledCustomer, setPrefilledCustomer] = useState<{ id?: string; team_name: string; fb_link: string | null; contact_phone: string | null } | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<any>(null);
  const [editingDueDate, setEditingDueDate] = useState<string>("");
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerId: "",
    amount: "",
    method: "GCash",
    reference: "",
    proofFile: null as File | null
  });

  const { totalBill, totalPaid, totalPending } = useMemo(() => {
    return orders.reduce((acc, o) => {
      const price = o.price || calculatePrice(
        o.product_type,
        o.item_type as "Set" | "Upper" | "Lower",
        o.size
      );
      acc.totalBill += Number(price || 0);
      return acc;
    }, { 
      totalBill: 0, 
      totalPaid: transactions.filter(tx => tx.status === 'verified').reduce((s, tx) => s + Number(tx.amount), 0),
      totalPending: transactions.filter(tx => tx.status === 'pending').reduce((s, tx) => s + Number(tx.amount), 0)
    });
  }, [orders, transactions]);

  const customerStats = useMemo(() => {
    const stats: Record<string, { totalItems: number, totalBill: number, totalPaid: number, pendingPayments: number }> = {};
    
    customers.forEach(c => {
      stats[c.id] = { totalItems: 0, totalBill: 0, totalPaid: 0, pendingPayments: 0 };
    });

    orders.forEach(o => {
      if (o.customers && stats[o.customers.id]) {
        stats[o.customers.id].totalItems++;
        
        // Use database price if exists, otherwise recalculate based on product details
        const price = o.price || calculatePrice(
          o.product_type,
          o.item_type as "Set" | "Upper" | "Lower",
          o.size
        );
        
        stats[o.customers.id].totalBill += Number(price || 0);
      }
    });

    transactions.forEach(tx => {
      if (stats[tx.customer_id]) {
        if (tx.status === 'verified') {
          stats[tx.customer_id].totalPaid += Number(tx.amount);
        } else if (tx.status === 'pending') {
          stats[tx.customer_id].pendingPayments += Number(tx.amount);
        }
      }
    });

    return stats;
  }, [customers, orders, transactions]);

  const handleReportPayment = async () => {
    if (!paymentForm.customerId || !paymentForm.amount || !paymentForm.proofFile) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields and upload proof.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Upload proof
      const fileExt = paymentForm.proofFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `payments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("designs") // Reusing designs bucket or you can create 'payments'
        .upload(filePath, paymentForm.proofFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("designs")
        .getPublicUrl(filePath);

      // 2. Create transaction
      const { data, error } = await supabase
        .from("transactions")
        .insert([{
          customer_id: paymentForm.customerId,
          amount: Number.parseFloat(paymentForm.amount),
          payment_method: paymentForm.method,
          reference_number: paymentForm.reference,
          proof_url: publicUrl,
          status: "pending"
        }])
        .select("*, customer:customers(team_name)");

      if (error) throw error;

      setTransactions(prev => [data[0], ...prev]);
      setIsPaymentDialogOpen(false);
      setPaymentForm({
        customerId: "",
        amount: "",
        method: "GCash",
        reference: "",
        proofFile: null
      });

      toast({
        title: "Payment Reported",
        description: "Your payment has been submitted for verification.",
      });
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateDueDate = async () => {
    if (!selectedCustomerForDetail) return;
    try {
      const { error } = await supabase
        .from("customers")
        .update({ due_date: editingDueDate || null })
        .eq("id", selectedCustomerForDetail.id);

      if (error) throw error;

      setCustomers(prev => prev.map(c => 
        c.id === selectedCustomerForDetail.id ? { ...c, due_date: editingDueDate || null } : c
      ));

      setIsEditingDate(false);
      toast({
        title: "Success",
        description: "Due date updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const fetchInitialData = async (sessionUser: User) => {
      const { data: stylesData } = await supabase.from("styles").select("*").order("name");
      setStyles(stylesData || []);
      const { data: customersData } = await supabase.from("customers").select("*, due_date").eq("reseller_id", sessionUser.id).order("team_name");
      
      const customersWithUrls = await Promise.all((customersData || []).map(async (c) => {
        if (!c.design_url) return c;
        try {
          const filePath = extractFilePath(c.design_url);
          const { data } = await supabase.storage.from("designs").createSignedUrl(filePath, 3600);
          return { ...c, _designSignedUrl: data?.signedUrl };
        } catch {
          return c;
        }
      }));
      setCustomers(customersWithUrls);
      
      const { data: txData } = await supabase
        .from("transactions")
        .select("*, customer:customers(team_name)")
        .order("created_at", { ascending: false });
      setTransactions(txData || []);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        fetchInitialData(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        fetchInitialData(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const generateSignedUrls = useCallback(async (ordersData: OrderWithCustomer[]) => {
    const updated = await Promise.all(
      ordersData.map(async (order) => {
        if (!order.customers?.design_url) return order;
        try {
          const filePath = extractFilePath(order.customers.design_url);
          const { data, error } = await supabase.storage
            .from("designs")
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          if (error) throw error;
          return { ...order, _designSignedUrl: data.signedUrl };
        } catch {
          return { ...order, _designSignedUrl: null };
        }
      })
    );
    return updated;
  }, []);

  const fetchOrders = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Refresh customer and transaction data as well
      const { data: customersData } = await supabase.from("customers").select("*, due_date").eq("reseller_id", user.id).order("team_name");
      
      const customersWithUrls = await Promise.all((customersData || []).map(async (c) => {
        if (!c.design_url) return c;
        try {
          const filePath = extractFilePath(c.design_url);
          const { data } = await supabase.storage.from("designs").createSignedUrl(filePath, 3600);
          return { ...c, _designSignedUrl: data?.signedUrl };
        } catch {
          return c;
        }
      }));
      setCustomers(customersWithUrls);
      
      const { data: txData } = await supabase
        .from("transactions")
        .select("*, customer:customers(team_name)")
        .order("created_at", { ascending: false });
      setTransactions(txData || []);

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          player_name_front,
          player_name_back,
          jersey_number,
          product_type,
          item_type,
          size,
          style,
          status,
          price,
          created_at,
          customers!inner (
            id,
            team_name,
            fb_link,
            contact_phone,
            design_url,
            reseller_id,
            due_date
          )
        `)
        .eq("customers.reseller_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const ordersWithUrls = await generateSignedUrls((data as any) || []);
      setOrders(ordersWithUrls);
    } catch (error: any) {
      console.error("Error fetching orders detail:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load your orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      // Use the 'representation' header to get the deleted data back
      // If data is empty, it means RLS blocked the deletion
      const { data, error } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this order or it is no longer pending.");
      }

      // Optimistic update: remove from local state immediately
      setOrders(prev => prev.filter(o => o.id !== orderId));

      toast({
        title: "Order Deleted",
        description: "The order has been successfully removed.",
      });
    } catch (error: any) {
      console.error("Error deleting order:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete the order.",
        variant: "destructive",
      });
    } finally {
      setOrderToDelete(null);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this customer.");
      }

      setCustomers(prev => prev.filter(c => c.id !== customerId));
      // Also need to refresh orders and transactions as they are cascaded
      await fetchOrders();

      toast({
        title: "Customer Removed",
        description: "The customer and all their associated data have been deleted.",
      });
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete the customer.",
        variant: "destructive",
      });
    } finally {
      setCustomerToDelete(null);
    }
  };

  useEffect(() => {
    if (user) fetchOrders();
  }, [user]);

  useEffect(() => {
    const fetchProofUrls = async () => {
      const urls: Record<string, string> = {};
      const txWithProofs = transactions.filter(tx => tx.proof_url && tx.proof_url.includes('designs/'));
      
      if (txWithProofs.length === 0) return;

      for (const tx of txWithProofs) {
        const path = tx.proof_url.split('designs/')[1];
        const { data } = await supabase.storage.from('designs').createSignedUrl(path, 3600);
        if (data?.signedUrl) urls[tx.id] = data.signedUrl;
      }
      setTxProofUrls(prev => ({ ...prev, ...urls }));
    };
    fetchProofUrls();
  }, [transactions]);

  const uniqueCustomers = useMemo(() => {
    const names = new Set<string>();
    orders.forEach((o) => {
      if (o.customers?.team_name) names.add(o.customers.team_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        searchQuery === "" ||
        order.player_name_back?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customers?.team_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesCustomer = customerFilter === "all" || order.customers?.team_name === customerFilter;

      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [orders, searchQuery, statusFilter, customerFilter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const SidebarItem = ({ id, label, icon: Icon, onClick }: { id: any, label: string, icon: any, onClick?: () => void }) => (
    <button
      onClick={() => {
        if (onClick) onClick();
        else setActiveTab(id);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        activeTab === id 
          ? "bg-primary text-primary-foreground shadow-md" 
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
      {activeTab === id && <ChevronRight className="ml-auto h-4 w-4" />}
    </button>
  );

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30 text-foreground">
      {/* Sidebar */}
      <aside className="w-64 h-full border-r bg-background flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b">
          <img 
            src="/favicon.png" 
            alt="Logo" 
            className="h-8 w-8 rounded-lg object-cover bg-white"
          />
          <span className="font-bold text-lg tracking-tight">Reseller Portal</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem id="orders" label="My Orders" icon={LayoutDashboard} />
          <SidebarItem 
            id="new_order" 
            label="New Order" 
            icon={ShoppingCart} 
            onClick={() => {
              setPrefilledCustomer(null);
              setActiveTab("new_order");
            }}
          />
          <SidebarItem id="catalog" label="Style Catalog" icon={BookOpen} />
          <SidebarItem id="balance" label="Balance" icon={Receipt} />
          <SidebarItem id="customers" label="My Customers" icon={Users} />
        </nav>

        <div className="p-4 border-t space-y-2">
          <SidebarItem id="settings" label="Settings" icon={Settings} />
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0">
          <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{user.email}</span>
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary">
              {user.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === "orders" ? (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle>My Submissions</CardTitle>
                        <CardDescription>View status of your customer orders</CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={fetchOrders}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search orders..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-48">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          {Object.keys(STATUS_CONFIG).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={customerFilter} onValueChange={setCustomerFilter}>
                        <SelectTrigger className="w-full sm:w-64">
                          <UserIcon className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="All Customers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          {uniqueCustomers.map((customer) => (
                            <SelectItem key={customer} value={customer}>
                              {customer}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-lg border overflow-hidden overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[180px]">Customer</TableHead>
                            <TableHead className="text-center">Design</TableHead>
                            <TableHead>Player Details</TableHead>
                            <TableHead>Jersey Info</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-24">
                                <div className="flex flex-col items-center gap-2">
                                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                                  <p className="text-sm text-muted-foreground font-medium">Loading orders...</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : filteredOrders.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-24 text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                  <Package className="h-12 w-12 opacity-20" />
                                  <p className="text-lg font-medium">No results found</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredOrders.map((order) => {
                              const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                              const designUrl = order._designSignedUrl;
                              return (
                                <TableRow key={order.id} className="hover:bg-muted/30 transition-colors group">
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-bold text-foreground truncate">{order.customers?.team_name || "Unknown Customer"}</p>
                                      <div className="flex flex-col text-[11px] text-muted-foreground mt-1">
                                        {order.customers?.contact_phone && (
                                          <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> {order.customers.contact_phone}
                                          </span>
                                        )}
                                        {order.customers?.fb_link && (
                                          <a 
                                            href={order.customers.fb_link} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-primary hover:underline"
                                          >
                                            <MessageCircle className="h-3 w-3" /> Profile
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {designUrl ? (
                                      <a 
                                        href={designUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-block group"
                                      >
                                        <div className="h-12 w-12 rounded-lg overflow-hidden border-2 border-muted bg-white flex items-center justify-center transition-all group-hover:scale-110 group-hover:border-primary shadow-sm">
                                          <img 
                                            src={designUrl} 
                                            alt="Design" 
                                            className="h-full w-full object-cover"
                                          />
                                        </div>
                                      </a>
                                    ) : (
                                      <div className="h-12 w-12 rounded-lg border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center bg-muted/20 mx-auto">
                                        N/A
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-primary text-base leading-tight">{order.player_name_back}</span>
                                      {order.player_name_front && (
                                        <span className="text-[11px] font-medium text-muted-foreground bg-muted w-fit px-1.5 rounded mt-0.5">
                                          Front: {order.player_name_front}
                                        </span>
                                      )}
                                      <span className="text-xs mt-1 font-mono text-muted-foreground">#{order.jersey_number}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold truncate max-w-[120px]">{order.product_type}</p>
                                      <div className="flex gap-1 flex-wrap items-center">
                                        <Badge variant="secondary" className="text-[10px] px-1 h-5">{order.item_type || "Set"}</Badge>
                                        <Badge variant="outline" className="text-[10px] px-1 h-5">{order.size}</Badge>
                                        <Badge variant="outline" className="text-[10px] px-1 h-5 capitalize">{order.style}</Badge>
                                      </div>
                                      <div className="flex items-center gap-1 mt-1 opacity-70">
                                        <Tag className="h-2 w-2 text-primary" />
                                        <span className="text-[8px] uppercase font-bold text-primary tracking-tighter">
                                          {getPriceDetails(order.product_type, (order.item_type || "Set") as any, order.size).category}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-primary font-bold">
                                    ₱{(order.price || calculatePrice(order.product_type, (order.item_type || "Set") as any, order.size)).toLocaleString()}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={`${config?.color || "bg-gray-500"} text-white border-none text-[11px]`}>
                                      {config?.label || order.status}
                                    </Badge>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {order.status === "pending" && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => setOrderToDelete(order.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : activeTab === "new_order" ? (
              <motion.div
                key={prefilledCustomer ? `new_order_${prefilledCustomer.team_name}` : "new_order"}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-primary uppercase tracking-tighter">Submit New Order</h3>
                    <p className="text-muted-foreground">Fill in the customer details and jersey specifications.</p>
                  </div>
                </div>
                <OrderPage 
                  initialCustomerData={prefilledCustomer || undefined}
                  onSuccess={() => {
                    fetchOrders();
                    setPrefilledCustomer(null);
                  }} 
                />
              </motion.div>
            ) : activeTab === "customers" ? (
              <motion.div
                key="customers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-primary">My Customers</h3>
                    <p className="text-muted-foreground">List of customers you manage.</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setPrefilledCustomer(null);
                      setActiveTab("new_order");
                    }} 
                    variant="outline" 
                    size="sm"
                  >
                    <Plus className="mr-2 h-4 w-4" /> Add New Customer
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customers.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground bg-card/50 rounded-xl border-2 border-dashed">
                      No customers registered yet.
                    </div>
                  ) : (
                    customers.map((customer) => {
                      const stats = customerStats[customer.id] || { totalItems: 0, totalPaid: 0, pendingPayments: 0 };
                      return (
                        <Card 
                          key={customer.id} 
                          className="border-none shadow-md bg-card/50 cursor-pointer hover:bg-card/80 transition-all group"
                          onClick={() => {
                            setSelectedCustomerForDetail(customer);
                            setEditingDueDate(customer.due_date || "");
                            setIsEditingDate(!customer.due_date);
                            setPaymentForm(prev => ({ ...prev, customerId: customer.id }));
                          }}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start gap-4">
                              <div className="h-14 w-14 shrink-0 rounded-lg overflow-hidden border-2 border-muted bg-white flex items-center justify-center shadow-sm">
                                {customer._designSignedUrl ? (
                                  <img 
                                    src={customer._designSignedUrl} 
                                    alt="Design" 
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="text-[10px] text-muted-foreground text-center px-1">No Design</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg font-bold uppercase group-hover:text-primary transition-colors truncate">{customer.team_name}</CardTitle>
                                <div className="flex flex-col">
                                  <CardDescription>Since {new Date(customer.created_at).toLocaleDateString()}</CardDescription>
                                  {customer.due_date && (
                                    <div className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1 mt-0.5">
                                      <Clock className="h-3 w-3" /> Due: {new Date(customer.due_date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomerToDelete(customer.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-all group-hover:translate-x-1" />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-4 gap-2 text-center py-2">
                              <div className="bg-muted/50 rounded p-1.5">
                                <p className="text-[9px] uppercase text-muted-foreground font-bold">Qty</p>
                                <p className="text-xs font-bold">{stats.totalItems}</p>
                              </div>
                              <div className="bg-primary/10 rounded p-1.5">
                                <p className="text-[9px] uppercase text-primary font-bold">Total</p>
                                <p className="text-xs font-bold text-primary">₱{stats.totalBill.toLocaleString()}</p>
                              </div>
                              <div className="bg-green-500/10 rounded p-1.5">
                                <p className="text-[9px] uppercase text-green-700 font-bold">Down</p>
                                <p className="text-xs font-bold text-green-600">₱{stats.totalPaid.toLocaleString()}</p>
                              </div>
                              <div className="bg-amber-500/10 rounded p-1.5">
                                <p className="text-[9px] uppercase text-amber-700 font-bold">Balance</p>
                                <p className="text-xs font-bold text-amber-600">₱{(stats.totalBill - stats.totalPaid).toLocaleString()}</p>
                              </div>
                            </div>

                            {customer.contact_phone && (
                              <div className="text-sm flex items-center gap-2 text-muted-foreground">
                                <UserIcon className="h-4 w-4 text-primary/60" /> {customer.contact_phone}
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button 
                                className="flex-1 text-[10px] h-8 uppercase font-bold" 
                                variant="secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomerFilter(customer.team_name);
                                  setActiveTab("orders");
                                }}
                              >
                                View Orders
                              </Button>
                              <Button 
                                className="flex-1 text-[10px] h-8 uppercase font-bold" 
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrefilledCustomer({
                                    id: customer.id,
                                    team_name: customer.team_name,
                                    fb_link: customer.fb_link,
                                    contact_phone: customer.contact_phone
                                  });
                                  setActiveTab("new_order");
                                }}
                              >
                                <Plus className="mr-1 h-3 w-3" /> Add Order
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>

                {/* Customer Detail & Payment Dialog */}
                <Dialog open={!!selectedCustomerForDetail} onOpenChange={(open) => !open && setSelectedCustomerForDetail(null)}>
                  <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <DialogHeader className="px-6 pt-6 pb-2 border-b bg-muted/20">
                      <DialogTitle className="text-2xl font-bold uppercase tracking-tighter flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" /> {selectedCustomerForDetail?.team_name}
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
                      {/* Due Date Management */}
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-end justify-between gap-4">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-amber-700 ml-1">Target Due Date</Label>
                          {isEditingDate ? (
                            <Input 
                              type="date" 
                              className="h-10 bg-white border-amber-200 focus-visible:ring-amber-500/30 focus-visible:ring-offset-0 focus-visible:border-amber-500 outline-none"
                              value={editingDueDate}
                              onChange={(e) => setEditingDueDate(e.target.value)}
                            />
                          ) : (
                            <div className="h-10 bg-white/50 border border-amber-100 rounded-md flex items-center px-3 text-sm font-semibold text-amber-900">
                              {editingDueDate ? new Date(editingDueDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : "No date set"}
                            </div>
                          )}
                        </div>
                        {isEditingDate ? (
                          <div className="flex gap-2">
                            {editingDueDate && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-10 text-muted-foreground hover:text-foreground text-xs font-bold uppercase focus-visible:ring-amber-500/30 focus-visible:ring-offset-0"
                                onClick={() => setIsEditingDate(false)}
                              >
                                Cancel
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              className="bg-amber-600 hover:bg-amber-700 text-white h-10 px-6 font-bold uppercase text-xs shadow-sm focus-visible:ring-amber-500/30 focus-visible:ring-offset-0"
                              onClick={handleUpdateDueDate}
                            >
                              Save Date
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-amber-300 text-amber-700 hover:bg-amber-100 h-10 px-6 font-bold uppercase text-xs focus-visible:ring-amber-500/30 focus-visible:ring-offset-0"
                            onClick={() => setIsEditingDate(true)}
                          >
                            {editingDueDate ? "Change Date" : "Set Due Date"}
                          </Button>
                        )}
                      </div>

                      {/* Stats Overview */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                         <div className="p-3 bg-muted/50 rounded-xl border border-dashed text-center">
                            <p className="text-[9px] uppercase text-muted-foreground font-bold mb-1">Items</p>
                            <p className="text-lg font-bold">{customerStats[selectedCustomerForDetail?.id]?.totalItems || 0}</p>
                         </div>
                         <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-center">
                            <p className="text-[9px] uppercase text-primary font-bold mb-1">Total Bill</p>
                            <p className="text-lg font-bold text-primary">₱{(customerStats[selectedCustomerForDetail?.id]?.totalBill || 0).toLocaleString()}</p>
                         </div>
                         <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                            <p className="text-[9px] uppercase text-green-700 font-bold mb-1">Downpay</p>
                            <p className="text-lg font-bold text-green-600">₱{(customerStats[selectedCustomerForDetail?.id]?.totalPaid || 0).toLocaleString()}</p>
                         </div>
                         <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                            <p className="text-[9px] uppercase text-amber-700 font-bold mb-1">Balance</p>
                            <p className="text-lg font-bold text-amber-600">₱{((customerStats[selectedCustomerForDetail?.id]?.totalBill || 0) - (customerStats[selectedCustomerForDetail?.id]?.totalPaid || 0)).toLocaleString()}</p>
                         </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button 
                          className="flex-1 h-11 uppercase font-bold text-xs" 
                          variant="outline"
                          onClick={() => {
                            setCustomerFilter(selectedCustomerForDetail?.team_name);
                            setActiveTab("orders");
                            setSelectedCustomerForDetail(null);
                          }}
                        >
                          View History
                        </Button>
                        <Button 
                          className="flex-1 h-11 uppercase font-bold text-xs shadow-md"
                          onClick={() => {
                            setPrefilledCustomer({
                              id: selectedCustomerForDetail?.id,
                              team_name: selectedCustomerForDetail?.team_name,
                              fb_link: selectedCustomerForDetail?.fb_link,
                              contact_phone: selectedCustomerForDetail?.contact_phone
                            });
                            setActiveTab("new_order");
                            setSelectedCustomerForDetail(null);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" /> Add Orders for this Team
                        </Button>
                      </div>

                      {/* Quick Payment Section */}
                      <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm uppercase tracking-tight">Report New Downpayment</h4>
                          <Badge className="bg-primary/20 text-primary border-none text-[10px]">VERIFICATION REQUIRED</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="detail-amount" className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Amount (₱)</Label>
                            <Input 
                              id="detail-amount" 
                              type="number" 
                              placeholder="0.00"
                              className="bg-background h-11"
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="detail-method" className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Method</Label>
                            <Select 
                              value={paymentForm.method} 
                              onValueChange={(v) => setPaymentForm(prev => ({ ...prev, method: v }))}
                            >
                              <SelectTrigger className="bg-background h-11">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GCash">GCash</SelectItem>
                                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                <SelectItem value="Maya">Maya</SelectItem>
                                <SelectItem value="Cash">Cash</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Proof of Payment</Label>
                          <Button
                            type="button"
                            variant="outline"
                            className={`w-full h-16 border-dashed bg-background ${paymentForm.proofFile ? 'border-primary' : ''}`}
                            onClick={() => document.getElementById('detail-proof-upload')?.click()}
                          >
                            {paymentForm.proofFile ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                <span className="text-xs truncate max-w-[300px]">{paymentForm.proofFile.name}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xs">Upload Screenshot / Slip</span>
                              </div>
                            )}
                          </Button>
                          <input 
                            id="detail-proof-upload"
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setPaymentForm(prev => ({ ...prev, proofFile: file }));
                            }}
                          />
                        </div>

                        <Button 
                          className="w-full h-12 uppercase font-bold shadow-lg shadow-primary/20" 
                          onClick={handleReportPayment}
                          disabled={isUploading}
                        >
                          {isUploading ? "Submitting..." : "Submit Payment Record"}
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 border-t bg-muted/30 grid grid-cols-2 gap-3 shrink-0">
                      <Button 
                        variant="ghost" 
                        className="w-full text-xs uppercase font-bold h-10"
                        onClick={() => {
                          setCustomerFilter(selectedCustomerForDetail.team_name);
                          setActiveTab("orders");
                          setSelectedCustomerForDetail(null);
                        }}
                      >
                        All Orders
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full text-xs uppercase font-bold h-10"
                        onClick={() => {
                            setSelectedCustomerForDetail(null);
                            setActiveTab("balance");
                        }}
                      >
                        Pay History
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </motion.div>
            ) : activeTab === "catalog" ? (
              <motion.div
                key="catalog"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-2xl font-bold text-primary">Style Catalog</h3>
                  <p className="text-muted-foreground">Browse available fabrics and jersey styles.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {styles.map((style) => (
                    <Card key={style.id} className="overflow-hidden border-none shadow-md bg-card/50">
                      <div className="aspect-video bg-muted flex items-center justify-center">
                        {style.image_url ? (
                          <img src={style.image_url} alt={style.name} className="w-full h-full object-cover" />
                        ) : (
                          <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                        )}
                      </div>
                      <CardHeader>
                        <CardTitle className="text-lg font-bold uppercase">{style.name}</CardTitle>
                        <CardDescription>{style.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </motion.div>
            ) : activeTab === "balance" ? (
              <motion.div
                key="balance"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-primary/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <BadgeDollarSign className="h-3 w-3" /> Total Sales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-id-extra text-primary">₱{totalBill.toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-1 tracking-widest">GROSS AMOUNT</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> Verified Paid
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-id-extra text-green-600">₱{totalPaid.toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase">Collected Deposits</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-500/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Clock className="h-3 w-3" /> Remaining
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-id-extra text-amber-600">₱{(totalBill - totalPaid).toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase">Balance</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-card overflow-hidden shadow-md">
                  <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold uppercase tracking-tighter text-sm">Payment History</h4>
                      <p className="text-[10px] text-muted-foreground uppercase">Logs of your reported deposits and slips</p>
                    </div>
                    <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="shadow-lg h-9 px-4 uppercase font-bold text-xs tracking-tight">
                          <Plus className="mr-2 h-4 w-4" /> Report Payment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle className="uppercase tracking-tighter">Report Deposit / Payment</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="customer">Customer / Team</Label>
                            <Select 
                              value={paymentForm.customerId} 
                              onValueChange={(v) => setPaymentForm(prev => ({ ...prev, customerId: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a customer" />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.team_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="amount">Amount (₱)</Label>
                              <Input 
                                id="amount" 
                                type="number" 
                                placeholder="0.00"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="method">Method</Label>
                              <Select 
                                value={paymentForm.method} 
                                onValueChange={(v) => setPaymentForm(prev => ({ ...prev, method: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="GCash">GCash</SelectItem>
                                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="Maya">Maya</SelectItem>
                                  <SelectItem value="Cash">Cash</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="reference">Reference Number (Optional)</Label>
                            <Input 
                              id="reference" 
                              placeholder="e.g. 1023 234 567"
                              value={paymentForm.reference}
                              onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Proof of Payment</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full h-24 flex-col gap-2 border-dashed"
                                onClick={() => document.getElementById('proof-upload')?.click()}
                              >
                                {paymentForm.proofFile ? (
                                  <>
                                    <ImageIcon className="h-6 w-6 text-primary" />
                                    <span className="text-xs truncate max-w-[200px]">{paymentForm.proofFile.name}</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-6 w-6 text-muted-foreground" />
                                    <span className="text-xs">Upload Screenshot / Slip</span>
                                  </>
                                )}
                              </Button>
                              <input 
                                id="proof-upload"
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) setPaymentForm(prev => ({ ...prev, proofFile: file }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            className="w-full uppercase font-bold" 
                            onClick={handleReportPayment}
                            disabled={isUploading}
                          >
                            {isUploading ? "Submitting..." : "Submit Payment Record"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Proof</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                            No payment history found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="font-bold">{tx.customer?.team_name}</TableCell>
                            <TableCell className="font-mono text-primary font-bold">₱{Number.parseFloat(tx.amount).toLocaleString()}</TableCell>
                            <TableCell className="text-xs uppercase font-medium">{tx.payment_method}</TableCell>
                            <TableCell>
                              <Badge className={
                                tx.status === 'verified' ? 'bg-green-500 text-white border-none' : 
                                tx.status === 'rejected' ? 'bg-destructive text-white border-none' :
                                'bg-amber-500 text-white border-none'
                              }>
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {tx.proof_url ? (
                                <a 
                                  href={txProofUrls[tx.id] || tx.proof_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-[10px] flex items-center gap-1"
                                >
                                  <ImageIcon className="h-3 w-3" /> View Slip
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 uppercase tracking-tighter">
                        <UserIcon className="h-5 w-5 text-primary" /> Account Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">Email</span>
                        <span className="font-medium truncate ml-2 text-right">{user.email}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className="bg-green-500 hover:bg-green-500 uppercase tracking-widest text-[10px] border-none">Active Reseller</Badge>
                      </div>
                      <Button variant="outline" className="w-full mt-4 h-11 border-primary/20 hover:bg-primary/5 text-primary" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out from Dashboard
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 uppercase tracking-tighter">
                        <Settings className="h-5 w-5 text-primary" /> Portal Preferences
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-tight">Notification Emails</p>
                          <p className="text-[11px] text-muted-foreground">Status update alerts</p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-tight">Display Locale</p>
                          <p className="text-[11px] text-muted-foreground">Regional formatting</p>
                        </div>
                        <Badge variant="outline" className="uppercase text-[10px]">PHP (₱)</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Global Modals/Dialogs */}
        <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this pending order. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => orderToDelete && handleDeleteOrder(orderToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Customer Profile?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this customer and ALL their associated orders and payment history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => customerToDelete && handleDeleteCustomer(customerToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
