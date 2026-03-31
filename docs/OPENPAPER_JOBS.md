# Open Paper jobs service (Celery)

The `openpaper/jobs` package runs **Celery workers** against **RabbitMQ** (broker) and **Redis** (result backend). PDF uploads enqueue tasks that pull files from **S3**, call the **LLM** for metadata, and webhook back to the FastAPI server.

Start infrastructure:

`docker compose -f ../docker-compose.openpaper.yml up -d`

Then follow `openpaper/jobs/README.md`: install Python deps with `uv`, set `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `S3_*`, `LLM_API_KEY`, and run the worker script (e.g. `./scripts/start_worker.sh` on Unix).

Without jobs + S3, FratNotes still stores PDFs locally; **Open Paper sync** may stay on `pending` until upstream processing completes.
