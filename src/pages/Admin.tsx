import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Download, LogOut, Filter, RefreshCw, 
  Package, Clock, Truck, CheckCircle2, Phone, MessageCircle,
  LayoutDashboard, Receipt, ChevronRight, Menu, CheckSquare,
  Users, Layers, Settings, Plus, Trash2, Edit, ShoppingCart, Tag, BadgeDollarSign
} from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";
import { OrderPage } from "@/components/OrderPage";
import { getPriceDetails, calculatePrice } from "@/lib/pricing";

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
  customers: {
    id: string;
    team_name: string;
    fb_link: string | null;
    contact_phone: string | null;
    design_url: string | null;
    reseller?: {
      email: string;
      role: string;
    } | null;
  } | null;
  _designSignedUrl?: string | null;
}

const STATUS_OPTIONS = ["pending", "in_production", "shipped", "completed"] as const;

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, color: "status-pending" },
  in_production: { label: "In Production", icon: Package, color: "status-in_production" },
  shipped: { label: "Shipped", icon: Truck, color: "status-shipped" },
  completed: { label: "Completed", icon: CheckCircle2, color: "status-completed" },
};

/**
 * Extracts the storage file path from a design URL.
 * Handles both full public URLs and plain file paths.
 */
function extractFilePath(designUrl: string): string {
  // If it's a full Supabase storage URL, extract the path after /designs/
  const match = /\/storage\/v1\/object\/(?:public|sign)\/designs\/(.+)/.exec(designUrl);
  if (match) return match[1];
  // Otherwise assume it's already a file path
  return designUrl;
}

export default function Admin() {
  const { user, isAdmin, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithCustomer[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"orders" | "confirmations" | "transactions" | "customers" | "inventory" | "settings" | "new_order">("orders");
  const isSidebarOpen = true; // Changed to constant as toggle logic wasn't fully utilized
  const [newStyle, setNewStyle] = useState({ name: "", description: "", image_url: "" });
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [styleToDelete, setStyleToDelete] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [tempAmount, setTempAmount] = useState<string>("");

  const updateOrderPrice = async (orderId: string, newPrice: number) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ price: newPrice })
        .eq("id", orderId);

      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, price: newPrice } : o));
      setEditingPriceId(null);
      toast({ title: "Price updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  };

  const updateTransactionAmount = async (txId: string, newAmount: number) => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ amount: newAmount })
        .eq("id", txId);

      if (error) throw error;

      setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, amount: newAmount } : tx));
      setEditingTxId(null);
      toast({ title: "Transaction amount updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  };

  const addStyle = async () => {
    if (!newStyle.name) return;
    try {
      const { data, error } = await supabase
        .from("styles")
        .insert([newStyle])
        .select();
      if (error) throw error;
      setStyles(prev => [...(data || []), ...prev]);
      setNewStyle({ name: "", description: "", image_url: "" });
      setIsStyleDialogOpen(false);
      toast({ title: "Style added successfully" });
    } catch (error: any) {
      toast({ title: "Failed to add style", variant: "destructive" });
    }
  };

  const deleteStyle = async (id: string) => {
    try {
      const { error } = await supabase.from("styles").delete().eq("id", id);
      if (error) throw error;
      setStyles(prev => prev.filter(s => s.id !== id));
      toast({ title: "Style removed" });
    } catch (error: any) {
      toast({ title: "Removal failed", variant: "destructive" });
    } finally {
      setStyleToDelete(null);
    }
  };

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

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          customer:customers!customer_id (
            team_name,
            reseller:profiles!reseller_id (email)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Generate signed URLs for transaction proofs
      const txWithUrls = await Promise.all((data || []).map(async (tx) => {
        if (!tx.proof_url) return tx;
        try {
          const filePath = extractFilePath(tx.proof_url);
          const { data: signData } = await supabase.storage.from("designs").createSignedUrl(filePath, 3600);
          return { ...tx, _proofSignedUrl: signData?.signedUrl };
        } catch {
          return tx;
        }
      }));

      setTransactions(txWithUrls);
    } catch (error: any) {
      logger.error("Error fetching transactions:", error);
    }
  }, []);

  const verifyTransaction = async (id: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from("transactions")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, status } : tx));
      toast({ title: `Transaction ${status}` });
    } catch (error: any) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const fetchStyles = useCallback(async () => {
    try {
      await fetchTransactions();
      const { data, error } = await supabase.from("styles").select("*").order("name");
      if (error) throw error;
      setStyles(data || []);
    } catch (error: any) {
      logger.error("Error fetching styles:", error);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      await fetchStyles();
      const { data, error } = await supabase
        .from("customers")
        .select(`
          *,
          reseller:profiles!reseller_id (
            email,
            role
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      logger.error("Error fetching customers:", error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchCustomers();
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
          created_at,
          customers:customers!customer_id (
            team_name,
            fb_link,
            contact_phone,
            design_url,
            reseller:profiles!reseller_id (
              email,
              role
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rawOrders = (data as unknown as OrderWithCustomer[]) || [];
      const ordersWithUrls = await generateSignedUrls(rawOrders);
      setOrders(ordersWithUrls);
    } catch (error: any) {
      logger.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [generateSignedUrls, toast]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchOrders();
    }
  }, [user, isAdmin, fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        searchQuery === "" ||
        order.player_name_back?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.player_name_front?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.jersey_number.includes(searchQuery) ||
        order.customers?.team_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesCustomer = customerFilter === "all" || order.customers?.team_name === customerFilter;

      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [orders, searchQuery, statusFilter, customerFilter]);

  const uniqueCustomers = useMemo(() => {
    const names = orders
      .map((o) => o.customers?.team_name)
      .filter((name): name is string => !!name);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  const pendingBatches = useMemo(() => {
    const map = new Map<string, {
      customerName: string,
      customer: any,
      designSignedUrl?: string | null,
      orders: OrderWithCustomer[],
      pendingCount: number,
      totalBill: number,
      totalPaid: number
    }>();

    orders.forEach(order => {
      const name = order.customers?.team_name || "Unknown";
      if (!map.has(name)) {
        // Calculate total verified payments for this customer
        const paid = transactions
          .filter(tx => tx.customer_id === order.customers?.id && tx.status === 'verified')
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        map.set(name, { 
          customerName: name, 
          customer: order.customers, 
          designSignedUrl: order._designSignedUrl,
          orders: [], 
          pendingCount: 0,
          totalBill: 0,
          totalPaid: paid
        });
      }
      const data = map.get(name)!;
      data.orders.push(order);
      
      // Use saved price or calculate on the fly for legacy orders
      const itemPrice = order.price || calculatePrice(order.product_type, order.item_type || "Set", order.size);
      data.totalBill += Number(itemPrice);

      if (order.status === "pending") {
        data.pendingCount++;
      }
    });

    return Array.from(map.values())
      .filter(b => b.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount);
  }, [orders, transactions]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus as any })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      toast({
        title: "Status Updated",
        description: `Order status changed to ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus}`,
      });
    } catch (error) {
      logger.error("Error updating status:", error);
      toast({
        title: "Update Failed",
        description: "Could not update order status",
        variant: "destructive",
      });
    }
  };

  const confirmBatch = async (batchOrders: OrderWithCustomer[]) => {
    try {
      const pendingIds = batchOrders
        .filter(o => o.status === "pending")
        .map(o => o.id);

      if (pendingIds.length === 0) return;

      const { error } = await supabase
        .from("orders")
        .update({ status: "in_production" })
        .in("id", pendingIds);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          pendingIds.includes(order.id) ? { ...order, status: "in_production" } : order
        )
      );

      toast({
        title: "Batch Confirmed",
        description: `Successfully moved ${pendingIds.length} orders to In Production`,
      });
    } catch (error) {
      console.error("Batch confirmation error:", error);
      toast({
        title: "Confirmation Failed",
        description: "Could not confirm the batch",
        variant: "destructive",
      });
    }
  };

  const confirmAllPending = async () => {
    try {
      const allPendingIds = orders
        .filter(o => o.status === "pending")
        .map(o => o.id);

      if (allPendingIds.length === 0) {
        toast({ title: "No pending orders", description: "All orders are already confirmed or processed." });
        return;
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: "in_production" })
        .in("id", allPendingIds);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          allPendingIds.includes(order.id) ? { ...order, status: "in_production" } : order
        )
      );

      toast({
        title: "All Orders Confirmed",
        description: `Successfully moved ${allPendingIds.length} orders to In Production`,
      });
    } catch (error) {
      console.error("Critical: Confirm all error:", error);
      toast({
        title: "Error",
        description: "Failed to confirm all pending orders",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = ["Customer Name", "Name (Front)", "Name (Back)", "Number", "Product", "Type", "Size", "Style", "Status", "Date"];
    const rows = filteredOrders.map((order) => [
      order.customers?.team_name || "",
      order.player_name_front || "",
      order.player_name_back,
      order.jersey_number,
      order.product_type,
      order.item_type || "Set",
      order.size,
      order.style,
      order.status,
      new Date(order.created_at).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `jersey-orders-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${filteredOrders.length} orders to CSV`,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const stats = useMemo(() => {
    const totalRev = orders.reduce((acc, o) => acc + (o.price || calculatePrice(o.product_type, o.item_type || "Set", o.size)), 0);
    
    // Transactions stats
    const txVerified = transactions
      .filter(tx => tx.status === 'verified')
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);
    
    const txPending = transactions
      .filter(tx => tx.status === 'pending')
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      inProduction: orders.filter((o) => o.status === "in_production").length,
      completed: orders.filter((o) => o.status === "completed").length,
      revenue: totalRev,
      balance: totalRev - txVerified,
      txVerified,
      txPending,
      txTotal: txVerified + txPending
    };
  }, [orders, transactions]);

  // Show nothing while checking auth/admin role
  if (authLoading || !user || !isAdmin) {
    return null;
  }

  const SidebarItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
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

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } h-full transition-all duration-300 border-r bg-background flex flex-col hidden md:flex`}
      >
        <div className="p-6 flex items-center gap-3 border-b">
          <img 
            src="/favicon.png" 
            alt="Logo" 
            className="h-8 w-8 rounded-lg object-cover bg-white"
          />
          {isSidebarOpen && <span className="font-bold text-lg tracking-tight">Admin Portal</span>}
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem id="orders" label="Dashboard" icon={LayoutDashboard} />
          <SidebarItem id="new_order" label="New Order" icon={ShoppingCart} />
          <SidebarItem id="confirmations" label="Confirmations" icon={CheckSquare} />
          <SidebarItem id="transactions" label="Transactions" icon={Receipt} />
          <SidebarItem id="customers" label="Customer List" icon={Users} />
          <SidebarItem id="inventory" label="Jersey Styles" icon={Layers} />
        </nav>

        <div className="p-4 border-t space-y-2">
          <SidebarItem id="settings" label="Settings" icon={Settings} />
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
            <LogOut className="mr-3 h-5 w-5" />
            {isSidebarOpen && "Logout"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{user?.email}</span>
            <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center font-bold text-primary">
              {user?.email?.[0].toUpperCase()}
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
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Total Orders", value: stats.total, icon: Package, color: "text-foreground" },
                    { label: "Pending", value: stats.pending, icon: Clock, color: "text-amber-500" },
                    { label: "In Production", value: stats.inProduction, icon: Package, color: "text-blue-500" },
                    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-green-500" },
                    { label: "Total Revenue", value: `₱${stats.revenue.toLocaleString()}`, icon: BadgeDollarSign, color: "text-primary" },
                    { label: "Collectibles", value: `₱${stats.balance.toLocaleString()}`, icon: Receipt, color: "text-red-500" },
                  ].map((stat) => (
                    <Card key={stat.label}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                            <p className={`text-xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
                          </div>
                          <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                            <stat.icon className="h-4 w-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Orders Content */}
                <Card className="border-none shadow-md overflow-hidden">
                  <CardHeader className="bg-background">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <CardTitle>Orders List</CardTitle>
                        <CardDescription>Real-time order tracking and management</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchOrders}>
                          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                          Sync
                        </Button>
                        <Button variant="default" size="sm" onClick={exportToCSV}>
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Customer name, player, or #number..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <Select value={customerFilter} onValueChange={setCustomerFilter}>
                          <SelectTrigger className="w-full sm:w-48">
                            <Package className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="All Customers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Customers</SelectItem>
                            {uniqueCustomers.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full sm:w-48">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Items</SelectItem>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {STATUS_CONFIG[status].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-lg border bg-background overflow-hidden overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-[200px]">Customer Name</TableHead>
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
                                  <p className="text-sm">Try adjusting your filters or search query.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredOrders.map((order) => {
                              const statusConfig = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG];
                              const designUrl = order._designSignedUrl;
                              return (
                                <TableRow key={order.id} className="hover:bg-muted/30 transition-colors group">
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="font-bold text-foreground truncate">{order.customers?.team_name || "Unknown Customer"}</p>
                                      {order.customers?.reseller && (
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 bg-primary/5 text-primary border-primary/20">
                                          Reseller: {order.customers.reseller.email.split('@')[0]}
                                        </Badge>
                                      )}
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
                                            <MessageCircle className="h-3 w-3" /> Profile Link
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
                                      <div className="h-12 w-12 rounded-lg border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center bg-muted/20">
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
                                          {getPriceDetails(order.product_type, order.item_type || "Set", order.size).category}
                                        </span>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-primary">
                                    {editingPriceId === order.id ? (
                                      <div className="flex items-center gap-1">
                                        <Input 
                                          className="h-7 w-20 text-[10px] px-1" 
                                          type="number" 
                                          value={tempAmount}
                                          onChange={(e) => setTempAmount(e.target.value)}
                                          onBlur={() => {
                                            if (tempAmount) updateOrderPrice(order.id, Number(tempAmount));
                                            else setEditingPriceId(null);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') updateOrderPrice(order.id, Number(tempAmount));
                                            if (e.key === 'Escape') setEditingPriceId(null);
                                          }}
                                          autoFocus
                                        />
                                      </div>
                                    ) : (
                                      <span 
                                        className="cursor-pointer hover:underline flex items-center gap-1"
                                        onClick={() => {
                                          setEditingPriceId(order.id);
                                          setTempAmount((order.price || calculatePrice(order.product_type, order.item_type || "Set", order.size)).toString());
                                        }}
                                      >
                                        ₱{(order.price || calculatePrice(order.product_type, order.item_type || "Set", order.size)).toLocaleString()}
                                        <Edit className="h-2 w-2 opacity-0 group-hover:opacity-100" />
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={`${statusConfig?.color || "bg-gray-500"} text-white border-none text-[11px]`}>
                                      {statusConfig?.label || order.status}
                                    </Badge>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Select
                                      value={order.status}
                                      onValueChange={(value) => updateOrderStatus(order.id, value)}
                                    >
                                      <SelectTrigger className="w-[120px] h-8 text-[11px] ml-auto">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {STATUS_OPTIONS.map((status) => (
                                          <SelectItem key={status} value={status} className="text-[11px]">
                                            {STATUS_CONFIG[status].label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
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
              <OrderPage onSuccess={() => {
                fetchOrders();
                setActiveTab("orders");
              }} />
            ) : activeTab === "confirmations" ? (
              <motion.div
                key="confirmations"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold">Pending Confirmations</h3>
                    <p className="text-sm text-muted-foreground">New batches awaiting initial confirmation</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {pendingBatches.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 font-bold"
                        onClick={confirmAllPending}
                      >
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Confirm All {orders.filter(o => o.status === "pending").length} Items
                      </Button>
                    )}
                    <Badge variant="secondary" className="px-3 py-1 text-sm font-bold">
                      {pendingBatches.length} Customers Waiting
                    </Badge>
                  </div>
                </div>

                {pendingBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-background rounded-xl border border-dashed">
                    <CheckCircle2 className="h-12 w-12 text-success opacity-20 mb-4" />
                    <p className="text-lg font-medium">All caught up!</p>
                    <p className="text-sm text-muted-foreground">No new customers needing confirmation.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingBatches.map((batch) => (
                      <Card key={batch.customerName} className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row items-stretch">
                          {/* Left Strip - Design */}
                          <div className="w-full md:w-32 bg-muted/30 flex items-center justify-center p-4 border-r">
                            {batch.designSignedUrl ? (
                              <a href={batch.designSignedUrl} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={batch.designSignedUrl} 
                                  className="h-20 w-20 object-cover rounded-lg border shadow-sm"
                                  alt="Design"
                                />
                              </a>
                            ) : (
                              <div className="h-20 w-20 rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground bg-white text-center px-1">
                                {batch.customer?.design_url ? "Loading..." : "No Design"}
                              </div>
                            )}
                          </div>

                          <div className="flex-1 p-6 flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <h4 className="text-xl font-bold">{batch.customerName}</h4>
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
                                  {batch.pendingCount} Pending Items
                                </Badge>
                                <Badge variant="outline" className={`border-none ${batch.totalPaid >= batch.totalBill && batch.totalBill > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {batch.totalPaid >= batch.totalBill && batch.totalBill > 0 ? 'Fully Paid' : `Paid: ₱${batch.totalPaid.toLocaleString()} / ₱${batch.totalBill.toLocaleString()}`}
                                </Badge>
                                {batch.customer?.reseller && (
                                  <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">
                                    Reseller: {batch.customer.reseller.email.split('@')[0]}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                {batch.customer?.contact_phone && (
                                  <span className="flex items-center gap-1.5">
                                    <Phone className="h-4 w-4" /> {batch.customer.contact_phone}
                                  </span>
                                )}
                                {batch.customer?.fb_link && (
                                  <span className="flex items-center gap-1.5">
                                    <MessageCircle className="h-4 w-4" /> Profile Attached
                                  </span>
                                )}
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-4 w-4" /> Submitted {new Date(batch.orders[0].created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="pt-2">
                                <div className="flex gap-1 flex-wrap">
                                  {batch.orders.slice(0, 5).map((o, i) => (
                                    <Badge key={o.id} variant="outline" className="text-[10px]">
                                      {o.player_name_back} (#{o.jersey_number})
                                    </Badge>
                                  ))}
                                  {batch.orders.length > 5 && (
                                    <span className="text-[10px] text-muted-foreground font-medium flex items-center px-2">
                                      + {batch.orders.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col justify-center gap-3 min-w-[150px]">
                              <Button 
                                className="w-full font-bold shadow-lg"
                                onClick={() => confirmBatch(batch.orders)}
                              >
                                <CheckSquare className="mr-2 h-4 w-4" />
                                Confirm Batch
                              </Button>
                              <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => {
                                  setCustomerFilter(batch.customerName);
                                  setActiveTab("orders");
                                }}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : activeTab === "customers" ? (
              <motion.div
                key="customers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-primary">Customer Registry</h3>
                    <p className="text-muted-foreground">Manage all registered customers and resellers.</p>
                  </div>
                  <Button onClick={fetchCustomers} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>

                <div className="rounded-lg border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Customer Name</TableHead>
                        <TableHead>Reseller</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                            No customers found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        customers.map((customer) => {
                          const orderCount = orders.filter(o => o.customers?.team_name === customer.team_name).length;
                          return (
                            <TableRow key={customer.id}>
                              <TableCell className="font-bold">{customer.team_name}</TableCell>
                              <TableCell>
                                {customer.reseller ? (
                                  <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">
                                    {customer.reseller.email.split('@')[0]}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Direct Customer</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {customer.contact_phone && <div>{customer.contact_phone}</div>}
                                  {customer.fb_link && (
                                    <a href={customer.fb_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                      <MessageCircle className="h-3 w-3" /> Profile
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{orderCount} items</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(customer.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setCustomerFilter(customer.team_name);
                                  setActiveTab("orders");
                                }}>
                                  View Orders
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            ) : activeTab === "transactions" ? (
              <motion.div
                key="transactions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-primary uppercase tracking-tighter">Transaction History</h3>
                    <p className="text-muted-foreground">Monitor and verify deposit slips from resellers.</p>
                  </div>
                  <Button onClick={fetchTransactions} variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                </div>

                {/* Transaction Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-primary/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <BadgeDollarSign className="h-3 w-3" /> Total Reported
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-primary">₱{stats.txTotal.toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Total Slips Submitted</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-500/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" /> Verified Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">₱{stats.txVerified.toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Success Transactions</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-500/5 border-none shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Clock className="h-3 w-3" /> For Verification
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-amber-600">₱{stats.txPending.toLocaleString()}</div>
                      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Pending Slips</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-lg border bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Customer</TableHead>
                        <TableHead>Reseller</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Proof</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            No transactions found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id} className="group">
                            <TableCell className="font-bold">{tx.customer?.team_name}</TableCell>
                            <TableCell>
                              <span className="text-xs text-muted-foreground">
                                {tx.customer?.reseller?.email?.split('@')[0] || "Direct"}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-primary">
                              {editingTxId === tx.id ? (
                                <Input 
                                  className="h-8 w-24 text-xs" 
                                  type="number" 
                                  value={tempAmount}
                                  onChange={(e) => setTempAmount(e.target.value)}
                                  onBlur={() => {
                                    if (tempAmount) updateTransactionAmount(tx.id, Number(tempAmount));
                                    else setEditingTxId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateTransactionAmount(tx.id, Number(tempAmount));
                                    if (e.key === 'Escape') setEditingTxId(null);
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <span 
                                  className="cursor-pointer hover:underline flex items-center gap-1"
                                  onClick={() => {
                                    if (tx.status === 'pending') { // Only allow editing if pending to avoid confusion
                                      setEditingTxId(tx.id);
                                      setTempAmount(tx.amount.toString());
                                    }
                                  }}
                                >
                                  ₱{Number.parseFloat(tx.amount).toLocaleString()}
                                  {tx.status === 'pending' && <Edit className="h-3 w-3 opacity-30" />}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{tx.payment_method}</TableCell>
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
                                <a href={tx._proofSignedUrl || tx.proof_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                                  <Download className="h-3 w-3" /> View Slip
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">No Proof</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {tx.status === 'pending' && (
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-green-600 border-green-200 hover:bg-green-50" onClick={() => verifyTransaction(tx.id, 'verified')}>
                                    Verify
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive border-red-200 hover:bg-red-50" onClick={() => verifyTransaction(tx.id, 'rejected')}>
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {tx.status !== 'pending' && (
                                <span className="text-[10px] text-muted-foreground">Processed</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            ) : activeTab === "inventory" ? (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-bold text-primary uppercase tracking-tighter">Jersey Style Catalog</h3>
                    <p className="text-muted-foreground">Manage fabric types and available styles.</p>
                  </div>
                  <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-primary shadow-lg">
                        <Plus className="mr-2 h-4 w-4" /> Add New Style
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Jersey Style</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Style Name</Label>
                          <Input 
                            placeholder="e.g. Pro-Fit Mesh" 
                            value={newStyle.name}
                            onChange={(e) => setNewStyle({...newStyle, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input 
                            placeholder="Briefly describe the fabric/style" 
                            value={newStyle.description}
                            onChange={(e) => setNewStyle({...newStyle, description: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Image URL</Label>
                          <Input 
                            placeholder="https://..." 
                            value={newStyle.image_url}
                            onChange={(e) => setNewStyle({...newStyle, image_url: e.target.value})}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStyleDialogOpen(false)}>Cancel</Button>
                        <Button onClick={addStyle}>Create Style</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog open={!!styleToDelete} onOpenChange={(open) => !open && setStyleToDelete(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this style from the catalog. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => styleToDelete && deleteStyle(styleToDelete)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove Style
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {styles.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground">
                      No styles defined yet.
                    </div>
                  ) : (
                    styles.map((style) => (
                      <Card key={style.id} className="overflow-hidden border-none shadow-md bg-card/50 group">
                        <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                          {style.image_url ? (
                            <img src={style.image_url} alt={style.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <Layers className="h-12 w-12 text-muted-foreground/30" />
                          )}
                          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => setStyleToDelete(style.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <CardHeader>
                          <CardTitle className="text-lg uppercase font-bold tracking-tight">{style.name}</CardTitle>
                          <CardDescription>{style.description || "No description provided."}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-between items-center bg-muted/20 py-3">
                          <Badge variant="outline" className="bg-primary/5 text-primary">Active Catalog</Badge>
                          <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                            <Edit className="h-3 w-3 mr-1" /> Edit
                          </Button>
                        </CardContent>
                      </Card>
                    ))
                  )}
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
                        <Users className="h-5 w-5 text-primary" /> Admin Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Logged in via</span>
                        <span className="font-medium truncate ml-2 text-right">{user?.email}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground">Access Level</span>
                        <Badge className="bg-primary hover:bg-primary uppercase tracking-widest text-[10px]">Administrator</Badge>
                      </div>
                      <Button variant="outline" className="w-full mt-4 h-11 border-primary/20 hover:bg-primary/5 text-primary" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out from Dashboard
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 uppercase tracking-tighter">
                        <Settings className="h-5 w-5 text-primary" /> System Controls
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-tight">Maintenance Mode</p>
                          <p className="text-[11px] text-muted-foreground">Disable ordering for all users</p>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Inactive</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-tight">Data Integrity</p>
                          <p className="text-[11px] text-muted-foreground">Cloud sync status</p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 uppercase text-[10px]">Healthy</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
