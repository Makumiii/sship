

export type NestedRunSequenceItem =  (hist?:string)=>Promise<string | null>


export type NestedRunSequence = {
    actionsTracker: [currentRunner:string][],
    list:{

        [name:string]:NestedRunSequenceItem
    }
}





export async  function runNested (sequenceList:NestedRunSequence, startItem?:string){

    const start = startItem ?? Object.keys(sequenceList.list)[0]
    if(!start) throw new Error('no start sequence item found')
    const result = sequenceList.list[start]
    if(!result) throw new Error('named sequence not found')
    const step = await result()
    sequenceList.actionsTracker.push([start])
    if(step === null) return 
    const nextSequenceItem = step.trim()
    await runNested(sequenceList, nextSequenceItem)
    


    

}