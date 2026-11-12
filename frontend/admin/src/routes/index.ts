const routes = [
  {
    path: "/apps/index",
    name: "BitLabsApps",
    component: () => import("../views/apps/index.vue"),
    meta: {
      title: "子系统",
      showLink: false,
      noLayout: true
    }
  }
] as RouteConfigsTable[];

export default routes;
