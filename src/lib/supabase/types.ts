// Database types for supabase-js, in the shape `supabase gen types typescript` produces.
// Regenerate with `pnpm db:types` (needs `supabase start`, which needs Docker) after every
// migration; until then, keep this file in sync with supabase/migrations by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      guesses: {
        Row: {
          created_at: string;
          device_id: string;
          game: string;
          id: number;
          item_id: string;
          puzzle: number;
          value: number;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          game: string;
          id?: never;
          item_id: string;
          puzzle: number;
          value: number;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          game?: string;
          id?: never;
          item_id?: string;
          puzzle?: number;
          value?: number;
        };
        Relationships: [];
      };
      poll_snapshots: {
        Row: {
          frozen_at: string;
          option: string;
          poll_id: string;
          total: number;
          votes: number;
        };
        Insert: {
          frozen_at: string;
          option: string;
          poll_id: string;
          total: number;
          votes: number;
        };
        Update: {
          frozen_at?: string;
          option?: string;
          poll_id?: string;
          total?: number;
          votes?: number;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          game: string;
          id: number;
          item_id: string;
          message: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          game: string;
          id?: never;
          item_id: string;
          message: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          game?: string;
          id?: never;
          item_id?: string;
          message?: string;
          status?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          created_at: string;
          device_id: string;
          game: string;
          id: number;
          option: string;
          poll_id: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          game: string;
          id?: never;
          option: string;
          poll_id: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          game?: string;
          id?: never;
          option?: string;
          poll_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      pair_accuracy: {
        Row: {
          game: string | null;
          n: number | null;
          pair_id: string | null;
          puzzle: number | null;
          share_correct: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      crowd_histogram: {
        Args: { p_bins?: number; p_game: string; p_item: string; p_puzzle: number };
        Returns: { bin: number; bin_from: number; bin_to: number; count: number }[];
      };
      crowd_median: {
        Args: { p_game: string; p_item: string; p_puzzle: number };
        Returns: { median: number | null; n: number }[];
      };
      freeze_polls: {
        Args: never;
        Returns: number;
      };
      hit_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number };
        Returns: boolean;
      };
      poll_results: {
        Args: { p_poll_id: string };
        Returns: { frozen_at: string | null; option: string; total: number; votes: number }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
