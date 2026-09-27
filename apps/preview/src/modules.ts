// The only packages uploaded code can import. Must match ALLOWED_IMPORTS in @ti/core.
import * as React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import * as Lucide from "lucide-react";
import * as Clsx from "clsx";
import * as TailwindMerge from "tailwind-merge";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as Select from "@radix-ui/react-select";
import * as Slider from "@radix-ui/react-slider";
import * as Slot from "@radix-ui/react-slot";
import * as Tabs from "@radix-ui/react-tabs";

export const MODULES: Record<string, unknown> = {
  react: React,
  "react/jsx-runtime": JsxRuntime,
  "lucide-react": Lucide,
  clsx: Clsx,
  "tailwind-merge": TailwindMerge,
  "@radix-ui/react-checkbox": Checkbox,
  "@radix-ui/react-dialog": Dialog,
  "@radix-ui/react-dropdown-menu": DropdownMenu,
  "@radix-ui/react-popover": Popover,
  "@radix-ui/react-select": Select,
  "@radix-ui/react-slider": Slider,
  "@radix-ui/react-slot": Slot,
  "@radix-ui/react-tabs": Tabs,
};
