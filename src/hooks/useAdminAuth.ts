import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { User, Session } from "@supabase/supabase-js";

/**
 * Hook that verifies both authentication AND admin role.
 * Redirects non-authenticated or non-admin users to /auth.
 */
export function useAdminAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminRole = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (error || !data) {
          logger.warn("User is not an admin, redirecting:", userId);
          setIsAdmin(false);
          navigate("/auth");
          return;
        }

        setIsAdmin(true);
      } catch (err) {
        logger.error("Error checking admin role:", err);
        setIsAdmin(false);
        navigate("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session?.user) {
          setIsAdmin(false);
          setIsLoading(false);
          navigate("/auth");
        } else {
          // Use setTimeout to prevent Supabase auth deadlock
          setTimeout(() => checkAdminRole(session.user.id), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setIsAdmin(false);
        setIsLoading(false);
        navigate("/auth");
      } else {
        checkAdminRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { user, session, isAdmin, isLoading };
}
