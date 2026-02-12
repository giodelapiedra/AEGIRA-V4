0|aegira-api  | {"level":30,"time":1770391649078,"service":"aegira-backend","requestId":"31aed2db-c66b-4108-812e-19609f3d8ca4","method":"GET","path":"/api/v1/teams/missed-check-ins","status":200,"duration":"1916ms","type":"response"}
0|aegira-api  | {"level":30,"time":1770391800030,"service":"aegira-backend","msg":"Running missed check-in detection"}
0|aegira-api  | prisma:error 
0|aegira-api  | Invalid `prisma.missedCheckIn.createMany()` invocation:
0|aegira-api  | {
0|aegira-api  |   data: [
0|aegira-api  |     {
0|aegira-api  |       company_id: "a68ee580-e592-4444-8b18-e8fff48af2c6",
0|aegira-api  |       person_id: "183f376c-7cbe-4e03-adab-a9980532a612",
0|aegira-api  |       team_id: "a176e44d-d0cb-46ab-bde0-e40cb8ad77c6",
0|aegira-api  |       missed_date: new Date("2026-02-06T00:00:00.000Z"),
0|aegira-api  |       schedule_window: "12:00 AM - 11:59 PM",
0|aegira-api  |       worker_role_at_miss: "WORKER",
0|aegira-api  |       day_of_week: 5,
0|aegira-api  |       week_of_month: 1,
0|aegira-api  |       days_since_last_check_in: null,
0|aegira-api  |       days_since_last_miss: 1,
0|aegira-api  |       check_in_streak_before: 0,
0|aegira-api  |       recent_readiness_avg: null,
0|aegira-api  |       misses_in_last_30d: 1,
0|aegira-api  |       misses_in_last_60d: 1,
0|aegira-api  |       misses_in_last_90d: 1,
0|aegira-api  |       baseline_completion_rate: 0,
0|aegira-api  |       is_first_miss_in_30d: false,
0|aegira-api  |       is_increasing_frequency: false,
0|aegira-api  |       reminder_sent: true,
0|aegira-api  |       reminder_failed: false
0|aegira-api  |     }
0|aegira-api  |   ],
0|aegira-api  |   skipDuplicates: true
0|aegira-api  | }
0|aegira-api  | Unknown argument `worker_role_at_miss`. Available options are marked with ?.
0|aegira-api  | {"level":50,"time":1770391805932,"service":"aegira-backend","error":{"name":"PrismaClientValidationError","clientVersion":"5.22.0"},"companyId":"a68ee580-e592-4444-8b18-e8fff48af2c6","msg":"Failed to process company for missed check-ins"}
0|aegira-api  | prisma:error 
0|aegira-api  | Invalid `prisma.missedCheckIn.createMany()` invocation:
0|aegira-api  | {
0|aegira-api  |   data: [
0|aegira-api  |     {
0|aegira-api  |       company_id: "f0ee43c6-5b6e-4946-801e-0bb15eef6d26",
0|aegira-api  |       person_id: "1d2ef946-2e50-481a-b33f-7d3c4cdf438b",
0|aegira-api  |       team_id: "a17a3382-3074-4b9f-b97b-a4a9ccfbeadf",
0|aegira-api  |       missed_date: new Date("2026-02-06T00:00:00.000Z"),
0|aegira-api  |       schedule_window: "6:00 AM - 2:32 PM",
0|aegira-api  |       worker_role_at_miss: "WORKER",
0|aegira-api  |       day_of_week: 5,
0|aegira-api  |       week_of_month: 1,
0|aegira-api  |       days_since_last_check_in: null,
0|aegira-api  |       days_since_last_miss: null,
0|aegira-api  |       check_in_streak_before: 0,
0|aegira-api  |       recent_readiness_avg: null,
0|aegira-api  |       misses_in_last_30d: 0,
0|aegira-api  |       misses_in_last_60d: 0,
0|aegira-api  |       misses_in_last_90d: 0,
0|aegira-api  |       baseline_completion_rate: 100,
0|aegira-api  |       is_first_miss_in_30d: true,
0|aegira-api  |       is_increasing_frequency: false,
0|aegira-api  |       reminder_sent: true,
0|aegira-api  |       reminder_failed: false
0|aegira-api  |     },
0|aegira-api  |     {
0|aegira-api  |       company_id: "f0ee43c6-5b6e-4946-801e-0bb15eef6d26",
0|aegira-api  |       person_id: "5d018f81-9001-4b5d-b6ae-2191e7c4bf62",
0|aegira-api  |       team_id: "e8fda852-3dc4-4c7f-abad-bb2fb41c3eb2",
0|aegira-api  |       missed_date: new Date("2026-02-06T00:00:00.000Z"),
0|aegira-api  |       schedule_window: "6:00 AM - 10:00 AM",
0|aegira-api  |       worker_role_at_miss: "WORKER",
0|aegira-api  |       day_of_week: 5,
0|aegira-api  |       week_of_month: 1,
0|aegira-api  |       days_since_last_check_in: null,
0|aegira-api  |       days_since_last_miss: 1,
0|aegira-api  |       check_in_streak_before: 0,
0|aegira-api  |       recent_readiness_avg: null,
0|aegira-api  |       misses_in_last_30d: 4,
0|aegira-api  |       misses_in_last_60d: 4,
0|aegira-api  |       misses_in_last_90d: 4,
0|aegira-api  |       baseline_completion_rate: 0,
0|aegira-api  |       is_first_miss_in_30d: false,
0|aegira-api  |       is_increasing_frequency: true,
0|aegira-api  |       reminder_sent: true,
0|aegira-api  |       reminder_failed: false
0|aegira-api  |     }
0|aegira-api  |   ],
0|aegira-api  |   skipDuplicates: true
0|aegira-api  | }
0|aegira-api  | Unknown argument `worker_role_at_miss`. Available options are marked with ?.
0|aegira-api  | {"level":50,"time":1770391811490,"service":"aegira-backend","error":{"name":"PrismaClientValidationError","clientVersion":"5.22.0"},"companyId":"f0ee43c6-5b6e-4946-801e-0bb15eef6d26","msg":"Failed to process company for missed check-ins"}
0|aegira-api  | {"level":30,"time":1770391811490,"service":"aegira-backend","totalDetected":0,"msg":"Missed check-in detection completed"}