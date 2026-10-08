import os
from dotenv import load_dotenv
from langfuse import get_client, propagate_attributes

load_dotenv()

pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
sk = os.environ.get("LANGFUSE_SECRET_KEY")
host = (
    os.environ.get("LANGFUSE_BASE_URL")
    or os.environ.get("LANGFUSE_HOST")
    or "https://us.cloud.langfuse.com"
)

print(f"Testing Langfuse with Host: {host}")
print(f"Public Key present: {bool(pk)}, Secret Key present: {bool(sk)}")

langfuse = get_client()

with langfuse.start_as_current_observation(
    as_type="span",
    name="test-first-trace",
    input="Hello from Chikki test script",
) as span:
    with propagate_attributes(trace_name="chikki-test-pipeline"):
        with langfuse.start_as_current_observation(
            as_type="generation",
            name="test-generation",
            model="llama-3.1-8b-instant",
            input="Hello",
        ) as gen:
            gen.update(output="Hi! Testing Langfuse v4 connection.")
    span.update(output="Finished")

langfuse.flush()
print("✅ Test trace sent and flushed successfully!")