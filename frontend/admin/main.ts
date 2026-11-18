import { createFlexAdmin } from "@bit-labs.cn/owl-ui/theme/default";
import adminSubsystem from "@bit-labs.cn/owl-admin-ui";
import cmsSubsystem from "@bit-labs.cn/owl-cms-ui";
import knowledgeSubsystem from "@bit-labs.cn/owl-knowledge-ui";
import commentSubsystem from "@bit-labs.cn/owl-comment-ui";
import portalSubsystem from "@bit-labs.cn/owl-portal-ui";
import smsSubsystem from "@bit-labs.cn/owl-sms-ui";
import fireflySubsystem from "@bit-labs.cn/firefly-cloud-ui";
import metricsSubsystem from "@bit-labs.cn/owl-metrics-ui";
import coordinatorSubsystem from "@bit-labs.cn/vlink-ui";
import notifySubsystem from "@bit-labs.cn/owl-notification-ui";
import bitLabsPortal from "./src/index";

createFlexAdmin({
  splitSubApp: {
    enable: true,
    home: "/apps/index"
  },
  subsystems: [
    portalSubsystem,
    cmsSubsystem,
    knowledgeSubsystem,
    smsSubsystem,
    coordinatorSubsystem,
    fireflySubsystem,
    metricsSubsystem,
    commentSubsystem,
    adminSubsystem,
    notifySubsystem,
    bitLabsPortal
  ]
}).then(app => app.mount("#app"));
