
As a Senior Software Engineer, please review and verify if the timezone and scheduling logic is correct.

The company has a defined timezone (for example, Australia/Sydney). During team creation in the dashboard, I set a specific check-in schedule time. This schedule should strictly follow the company’s timezone.

Expected behavior:

The check-in time set during team creation must be saved and interpreted using the company timezone.

Workers must check in based on the company timezone, not their local device or browser timezone.

The scheduled date and time should not automatically shift due to timezone conversion.

The schedule should only change if it is manually modified.

Workers in different countries must still follow the company timezone schedule without time discrepancies.

Please check if this logic is implemented correctly.
Let me know if there are any issues or potential timezone conversion bugs.