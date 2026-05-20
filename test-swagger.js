import fs from 'fs';
async function getSwagger() {
    const res = await fetch("https://fluakqeloiirlcuxunva.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdWFrcWVsb2lpcmxjdXh1bnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTI4NDMsImV4cCI6MjA5MDU4ODg0M30.vM7AXnX9xCvKHeakN2B8Z2Qf0fwheHEwVKAJ8nlej4o");
    const json = await res.json();
    fs.writeFileSync('openapi-response.json', JSON.stringify(json, null, 2));
}
getSwagger();
