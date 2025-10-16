interface MessageComposerProps {
    subject: string;
    body: string;
    setSubject: React.Dispatch<React.SetStateAction<string>>;
    setBody: React.Dispatch<React.SetStateAction<string>>;
}

export function MessageComposer({ subject, body, setSubject, setBody }: MessageComposerProps) {
    return (
        <div className="space-y-3">
            <input
                className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
                className="w-full px-3 py-2 rounded-md bg-gray-800 text-gray-100 border border-gray-700 h-28"
                placeholder="Message body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
            />
        </div>
    );
}