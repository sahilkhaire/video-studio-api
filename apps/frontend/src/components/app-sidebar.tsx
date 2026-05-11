import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  ListIcon,
  ChartBarIcon,
  UsersIcon,
  CameraIcon,
  Settings2Icon,
  CircleHelpIcon,
  SearchIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FolderOpenDotIcon,
  CommandIcon,
} from "lucide-react"

export type AppView =
  | "overview"
  | "generate"
  | "jobs"
  | "providers"
  | "costs"
  | "health"

type MainMenuSection = {
  label: string
  items: {
    key: AppView
    title: string
    icon: React.ReactNode
  }[]
}

const mainMenu: MainMenuSection[] = [
  {
    label: "Create & Track",
    items: [
      {
        key: "generate",
        title: "Generate Video",
        icon: (
          <CameraIcon
          />
        ),
      },
      {
        key: "jobs",
        title: "Job Status",
        icon: (
          <ListIcon
          />
        ),
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        key: "overview",
        title: "Overview",
        icon: (
          <LayoutDashboardIcon
          />
        ),
      },
      {
        key: "costs",
        title: "Cost Summary",
        icon: (
          <ChartBarIcon
          />
        ),
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        key: "providers",
        title: "Providers",
        icon: (
          <UsersIcon
          />
        ),
      },
      {
        key: "health",
        title: "Health",
        icon: (
          <CircleHelpIcon
          />
        ),
      },
    ],
  },
]

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: mainMenu,
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
    },
    {
      title: "Get Help",
      url: "#",
      icon: (
        <CircleHelpIcon
        />
      ),
    },
    {
      title: "Search",
      url: "#",
      icon: (
        <SearchIcon
        />
      ),
    },
  ],
  documents: [
    {
      name: "Provider Catalog",
      url: "#",
      icon: (
        <DatabaseIcon
        />
      ),
    },
    {
      name: "Cost Reports",
      url: "#",
      icon: (
        <FileChartColumnIcon
        />
      ),
    },
    {
      name: "Artifacts",
      url: "#",
      icon: (
        <FolderOpenDotIcon
        />
      ),
    },
  ],
}

export function AppSidebar({
  currentView,
  onViewChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentView: AppView
  onViewChange: (view: AppView) => void
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Acme Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain}
          activeItem={currentView}
          onSelect={onViewChange}
        />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
