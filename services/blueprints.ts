export interface Blueprint {
  id: string;
  name: string;
  description: string;
  xml: string;
}

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'three-act-structure',
    name: 'Three-Act Structure',
    description: 'A classic storytelling framework that divides a narrative into three parts: Setup, Confrontation, and Resolution.',
    xml: `
<WriterAidData>
    <Projects>
        <Project id="root" name="Three-Act Structure" parentId="" category="Novel" childCategoryName="Act" lastModified="">
            <Cards></Cards>
        </Project>
        <Project id="act1" name="Act I: The Setup" parentId="root" category="Act" childCategoryName="Beat" lastModified="">
            <Cards>
                <Card id="a1c1"><![CDATA[<h3>Opening Image</h3><p><em>A visual that represents the central theme and the protagonist's starting point before their journey begins. What is the "before" snapshot of your character's world?</em></p><p><br></p>]]></Card>
                <Card id="a1c2"><![CDATA[<h3>Theme Stated</h3><p><em>Usually spoken by a side character, this is a line of dialogue or a moment that overtly states the story's theme or moral question.</em></p><p><br></p>]]></Card>
                <Card id="a1c3"><![CDATA[<h3>The Setup</h3><p><em>Introduce the protagonist and their world. Show their flaws, wants, and needs. What does their life look like, and what is missing from it?</em></p><p><br></p>]]></Card>
                <Card id="a1c4"><![CDATA[<h3>Catalyst (Inciting Incident)</h3><p><em>The event that disrupts the protagonist's ordinary world and sets the story in motion. This is the telegram, the call to adventure, the discovery.</em></p><p><br></p>]]></Card>
                <Card id="a1c5"><![CDATA[<h3>Debate</h3><p><em>A moment of hesitation. The protagonist questions whether to accept the call to adventure. What are their fears? Why might they refuse the journey?</em></p><p><br></p>]]></Card>
                <Card id="a1c6"><![CDATA[<h3>Break into Two</h3><p><em>The protagonist makes a choice and fully commits to the journey, leaving their ordinary world behind and entering the "upside-down world" of Act II.</em></p><p><br></p>]]></Card>
            </Cards>
        </Project>
        <Project id="act2" name="Act II: The Confrontation" parentId="root" category="Act" childCategoryName="Beat" lastModified="">
            <Cards>
                <Card id="a2c1"><![CDATA[<h3>B Story</h3><p><em>Introduce a new character or relationship that helps explore the story's theme. This is often the love interest, mentor, or foil.</em></p><p><br></p>]]></Card>
                <Card id="a2c2"><![CDATA[<h3>Fun and Games</h3><p><em>The "promise of the premise." This is where the protagonist explores the new world, either thriving or failing as they learn its rules. It's the fun, the action, the core of the movie trailer.</em></p><p><br></p>]]></Card>
                <Card id="a2c3"><![CDATA[<h3>Midpoint</h3><p><em>A major event that raises the stakes, often shifting the protagonist from reactive to proactive. This can be a false victory or a false defeat.</em></p><p><br></p>]]></Card>
                <Card id="a2c4"><![CDATA[<h3>Bad Guys Close In</h3><p><em>The opposition (antagonist, internal flaws, etc.) regroups and applies mounting pressure on the protagonist, leading to greater challenges.</em></p><p><br></p>]]></Card>
                <Card id="a2c5"><![CDATA[<h3>All Is Lost</h3><p><em>The lowest point for the protagonist. An event that feels like a total defeat. Often includes a "whiff of death" (literal or metaphorical).</em></p><p><br></p>]]></Card>
                <Card id="a2c6"><![CDATA[<h3>Dark Night of the Soul</h3><p><em>In the wake of the "All Is Lost" moment, the protagonist reflects on their journey and what they've learned. They must find the strength to continue.</em></p><p><br></p>]]></Card>
                <Card id="a2c7"><![CDATA[<h3>Break into Three</h3><p><em>Thanks to a revelation from the Dark Night of the Soul, the protagonist formulates a new plan and re-commits to achieving their goal, setting up the final confrontation.</em></p><p><br></p>]]></Card>
            </Cards>
        </Project>
        <Project id="act3" name="Act III: The Resolution" parentId="root" category="Act" childCategoryName="Beat" lastModified="">
            <Cards>
                <Card id="a3c1"><![CDATA[<h3>Finale</h3><p><em>The protagonist confronts the antagonist, using the lessons learned throughout the story to overcome the final obstacle. This is the climax.</em></p><p><br></p>]]></Card>
                <Card id="a3c2"><![CDATA[<h3>Final Image</h3><p><em>A mirror of the Opening Image, showing how much the protagonist and their world have changed. This is the "after" snapshot.</em></p><p><br></p>]]></Card>
            </Cards>
        </Project>
    </Projects>
</WriterAidData>
`
  },
  {
    id: 'character-profile',
    name: 'Character Profile',
    description: 'A comprehensive template for crafting deep, believable characters with clear motivations, flaws, and arcs.',
    xml: `
<WriterAidData>
    <Projects>
        <Project id="root" name="Character Profile" parentId="" category="Character" childCategoryName="Trait">
            <Cards>
                <Card id="cpc1"><![CDATA[<h3>Core Concept</h3><blockquote><em>A one-sentence summary of the character. Who are they at their core? Example: "A guilt-ridden detective who seeks redemption by solving the one case that haunts him."</em></blockquote><p><br></p>]]></Card>
                <Card id="cpc2"><![CDATA[<h3>Physical Description</h3><ul><li><strong>Appearance:</strong><em> How do they look? Think beyond hair/eye color to posture, style, and distinguishing features.</em></li><li><strong>Voice:</strong><em> What do they sound like? Consider pitch, accent, and common speech patterns.</em></li><li><strong>Mannerisms:</strong><em> What are their tells? (e.g., taps fingers when nervous, avoids eye contact).</em></li></ul><p><br></p>]]></Card>
                <Card id="cpc3"><![CDATA[<h3>Goals & Motivations</h3><ul><li><strong>External Goal (The Want):</strong><em> What is the tangible goal the plot revolves around? (e.g., win the championship, find the treasure).</em></li><li><strong>Internal Goal (The Need):</strong><em> What is the subconscious emotional or spiritual goal they must achieve to be fulfilled? (e.g., to learn to trust, to forgive themself).</em></li></ul><p><br></p>]]></Card>
                <Card id="cpc4"><![CDATA[<h3>The Core Wound & The Lie</h3><blockquote><em>Every compelling character is driven by a past event that shaped them—their "core wound." This event informs their fears, their motivations, and their flawed view of the world.</em></blockquote><ul><li><strong>The Wound:</strong><em> What single event from their past hurt them the most?</em></li><li><strong>The Lie They Believe:</strong><em> As a result of this wound, what false belief do they hold about themself or the world? (e.g., "I'm unlovable," or "You can't trust anyone."). The story is often about them learning the truth.</em></li></ul><p><br></p>]]></Card>
                <Card id="cpc5"><![CDATA[<h3>Strengths & Flaws</h3><ul><li><strong>Strengths:</strong><em> What are their greatest skills and virtues? (e.g., courageous, witty, loyal).</em></li><li><strong>Flaws:</strong><em> What are their significant character flaws? How does "The Lie" manifest in their behavior? (e.g., arrogant, reckless, emotionally distant).</em></li></ul><p><br></p>]]></Card>
                <Card id="cpc6"><![CDATA[<h3>Relationships</h3><p><em>List key characters and define their relationship. Who is their ally, mentor, antagonist, or love interest? How do these relationships challenge or support the character?</em></p><p><br></p>]]></Card>
                <Card id="cpc7"><![CDATA[<h3>Character Arc</h3><blockquote><em>How does the character change from the beginning of the story to the end?</em></blockquote><ul><li><strong>Beginning:</strong><em> Living in a state of imperfection, governed by their flaw and "The Lie."</em></li><li><strong>Middle:</strong><em> The journey forces them to confront their flaw. They are tested and begin to see the cracks in their worldview.</em></li><li><strong>End:</strong><em> They either overcome their flaw by learning the story's truth (Positive Arc), or they are consumed by it (Tragedy).</em></li></ul><p><br></p>]]></Card>
            </Cards>
        </Project>
    </Projects>
</WriterAidData>
`
  }
];