
export const DUMMY_XML_DATA = `
<WriterAidData>
    <Projects>
        <Project id="1" name="My Novel" parentId="" category="Novel" childCategoryName="Chapter" notes="A story about Walter, a man down on his luck, and his fateful encounter in a deli." lastModified="2024-05-21T10:00:00Z">
            <Cards>
                <Card id="1-1"><![CDATA[It was a dark and stormy night... well, not really. It was more of a slightly overcast afternoon with a chance of drizzle. But Walter felt stormy on the inside.]]></Card>
            </Cards>
        </Project>
        <Project id="1-chap-1" name="The Incident at the Deli" parentId="1" category="Chapter" childCategoryName="Scene" notes="" lastModified="2024-05-21T10:05:00Z">
            <Cards>
                <Card id="1-chap-1-1"><![CDATA[The pickle aisle was where it all went wrong. One moment, Walter was contemplating the existential dread of choosing between dill and bread-and-butter chips. The next, he was face-to-face with Beatrice Maven, a woman who could curdle milk with a single disapproving glare.]]></Card>
                <Card id="1-chap-1-2"><![CDATA["Walter," she said, her voice like gravel being slowly ground under a sensible shoe. "Fancy seeing you here. I thought you'd be... elsewhere."]]></Card>
            </Cards>
        </Project>
        <Project id="2" name="Research Notes" parentId="" category="Notes" childCategoryName="Note" notes="" lastModified="2024-05-20T14:30:00Z">
            <Cards>
                <Card id="2-1"><![CDATA[Idea: Add a metaphor about time as an ocean.]]></Card>
                 <Card id="2-2"><![CDATA[Note: Research Victorian slang for authenticity.]]></Card>
            </Cards>
        </Project>
    </Projects>
</WriterAidData>
`;

export const LOCAL_STORAGE_KEY = 'writer_aid_data_xml';
export const INBOX_PROJECT_ID = 'flowstate-inbox-project';
export const INBOX_PROJECT_NAME = 'Inbox';