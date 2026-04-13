import { useRef, type FormEvent } from "react";

export function APITester() {
  const responseInputRef = useRef<HTMLTextAreaElement>(null);

  const testEndpoint = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const endpoint = formData.get("endpoint") as string;
      const url = new URL(endpoint, location.href);
      const method = formData.get("method") as string;
      const body = formData.get("body") as string;

      const options: RequestInit = { method };
      if (method === "POST" && body) {
        options.headers = { "Content-Type": "application/json" };
        options.body = body;
      }

      const res = await fetch(url, options);

      const data = await res.json();
      responseInputRef.current!.value = JSON.stringify(data, null, 2);
    } catch (error) {
      responseInputRef.current!.value = String(error);
    }
  };

  return (
    <div className="api-tester">
      <form onSubmit={testEndpoint} className="endpoint-row">
        <select name="method" className="method">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
        <input type="text" name="endpoint" defaultValue="/api/packages" className="url-input" placeholder="/api/packages" />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
      <textarea name="body" placeholder='{"recipient_name": "Juan Pérez", "description": "Paquete de libros"}' className="body-area" />
      <textarea ref={responseInputRef} readOnly placeholder="Response will appear here..." className="response-area" />
    </div>
  );
}
