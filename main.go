package main

import (
	_ "time/tzdata"

	firefly "firefly-cloud/app"

	metricsapp "bit-labs.cn/owl-metrics/app"

	"bit-labs.cn/owl"
	admin "bit-labs.cn/owl-admin/app"
	cms "bit-labs.cn/owl-cms/app"
	portal "bit-labs.cn/owl-portal/app"
	sms "bit-labs.cn/owl-sms/app"
)

func main() {
	owl.NewApp(
		&portal.SubAppPortal{},
		&cms.SubAppCms{},
		&sms.SubAppSms{},
		&firefly.SubAppFirefly{},
		&metricsapp.SubAppMetrics{},
		&admin.SubAppAdmin{},
	).WebShell()
}
